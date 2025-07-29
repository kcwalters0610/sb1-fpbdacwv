import React, { useState, useEffect } from 'react'
import { Plus, Search, Building2, FileText, DollarSign, Calendar, Edit, Trash2, Eye, X, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'
import { getNextNumber } from '../lib/numbering'

interface PurchaseOrder {
  id: string
  company_id: string
  vendor_id: string
  work_order_id?: string
  po_number: string
  status: 'draft' | 'sent' | 'approved' | 'received' | 'cancelled'
  order_date: string
  expected_delivery?: string
  subtotal: number
  tax_amount: number
  total_amount: number
  notes?: string
  created_at: string
  updated_at: string
  vendor?: any
  work_order?: any
  items?: PurchaseOrderItem[]
}

interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  company_id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  created_at: string
  updated_at: string
}

interface Vendor {
  id: string
  name: string
  contact_person?: string
  email?: string
  phone?: string
}

interface WorkOrder {
  id: string
  wo_number: string
  title: string
}

export default function PurchaseOrders() {
  const { viewType, setViewType } = useViewPreference('purchaseOrders')
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [formData, setFormData] = useState({
    po_number: '',
    vendor_id: '',
    work_order_id: '',
    status: 'draft',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery: '',
    notes: '',
    tax_rate: '0'
  })

  const [lineItems, setLineItems] = useState<Omit<PurchaseOrderItem, 'id' | 'purchase_order_id' | 'company_id' | 'created_at' | 'updated_at'>[]>([
    { description: '', quantity: 1, unit_price: 0, amount: 0 }
  ])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // Check if there's a preselected work order from MyJobs
    const preselectedWorkOrder = localStorage.getItem('preselected_work_order')
    if (preselectedWorkOrder && !editingPO) {
      setFormData(prev => ({ ...prev, work_order_id: preselectedWorkOrder }))
      localStorage.removeItem('preselected_work_order') // Clean up
    }
  }, [showForm, editingPO])

  useEffect(() => {
    // Generate PO number when form opens
    if (showForm && !editingPO) {
      generatePONumber()
    }
  }, [showForm, editingPO])

  const generatePONumber = async () => {
    try {
      const { formattedNumber: poNumber } = await getNextNumber('purchase_order')
      setFormData(prev => ({ ...prev, po_number: poNumber }))
    } catch (error) {
      console.error('Error generating PO number:', error)
    }
  }

  const loadData = async () => {
    try {
      const [posResult, vendorsResult, workOrdersResult] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select(`
            *,
            vendor:vendors(*),
            work_order:work_orders(id, wo_number, title),
            items:purchase_order_items(*)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('vendors').select('id, name, contact_person, email, phone').order('name'),
        supabase.from('work_orders').select('id, wo_number, title').order('created_at', { ascending: false })
      ])

      setPurchaseOrders(posResult.data || [])
      setVendors(vendorsResult.data || [])
      setWorkOrders(workOrdersResult.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addLineItem = () => {
    const newItem = {
      description: '',
      quantity: 1,
      unit_price: 0,
      amount: 0
    }
    setLineItems([...lineItems, newItem])
  }

  const updateLineItem = (index: number, field: keyof Omit<PurchaseOrderItem, 'id' | 'purchase_order_id' | 'company_id' | 'created_at' | 'updated_at'>, value: string | number) => {
    setLineItems(items => items.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value }
        if (field === 'quantity' || field === 'unit_price') {
          const quantity = field === 'quantity' ? Number(value) : item.quantity
          const unitPrice = field === 'unit_price' ? Number(value) : item.unit_price
          updatedItem.amount = quantity * unitPrice
        }
        return updatedItem
      }
      return item
    }))
  }

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(items => items.filter((_, i) => i !== index))
    }
  }

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
    const taxRate = parseFloat(formData.tax_rate) || 0
    const taxAmount = (subtotal * taxRate) / 100
    const total = subtotal + taxAmount

    return { subtotal, taxAmount, total }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)

    try {
      // Get current user's company_id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()
      
      if (!profile) throw new Error('User profile not found')

      const { subtotal, taxAmount, total } = calculateTotals()

      const poData = {
        company_id: profile.company_id,
        vendor_id: formData.vendor_id,
        work_order_id: formData.work_order_id || null,
        po_number: formData.po_number,
        status: formData.status,
        order_date: formData.order_date,
        expected_delivery: formData.expected_delivery || null,
        subtotal,
        tax_amount: taxAmount,
        total_amount: total,
        notes: formData.notes || null
      }

      let purchaseOrderId: string

      if (editingPO) {
        const { error } = await supabase
          .from('purchase_orders')
          .update(poData)
          .eq('id', editingPO.id)
        if (error) throw error
        purchaseOrderId = editingPO.id
      } else {
        const { formattedNumber: poNumber, nextSequence } = await getNextNumber('purchase_order')
        poData.po_number = poNumber
        
        const { data, error } = await supabase
          .from('purchase_orders')
          .insert([poData])
          .select()
        if (error) throw error
        purchaseOrderId = data[0].id
        
        // Update the sequence number
        await updateNextNumber('purchase_order', nextSequence)
      }
    
      // Handle line items
      if (editingPO) {
        // Delete existing items
        const { error: deleteError } = await supabase
          .from('purchase_order_items')
          .delete()
          .eq('purchase_order_id', purchaseOrderId)
        if (deleteError) throw deleteError
      }

      const itemsToInsert = lineItems.map(item => ({
        purchase_order_id: purchaseOrderId,
        company_id: profile.company_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount
      }))

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert)
      if (itemsError) throw itemsError

      await loadData()
      setShowForm(false)
      setEditingPO(null)
      resetForm()
    } catch (error) {
      console.error('Error saving purchase order:', error)
      alert('Error saving purchase order: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      po_number: '',
      vendor_id: '',
      work_order_id: '',
      status: 'draft',
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery: '',
      notes: '',
      tax_rate: '0'
    })
    setLineItems([
      { description: '', quantity: 1, unit_price: 0, amount: 0 }
    ])
  }

  const startEdit = (po: PurchaseOrder) => {
    setEditingPO(po)
    setFormData({
      po_number: po.po_number,
      vendor_id: po.vendor_id,
      work_order_id: po.work_order_id || '',
      status: po.status,
      order_date: po.order_date,
      expected_delivery: po.expected_delivery || '',
      notes: po.notes || '',
      tax_rate: ((po.tax_amount / po.subtotal) * 100).toFixed(2)
    })

    // Load line items
    if (po.items && po.items.length > 0) {
      setLineItems(po.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount
      })))
    } else {
      setLineItems([
        { description: '', quantity: 1, unit_price: 0, amount: 0 }
      ])
    }
    setShowForm(true)
  }

  const deletePO = async (id: string) => {
    if (!confirm('Are you sure you want to delete this purchase order?')) return

    try {
      // Delete line items first (cascade should handle this, but just to be safe)
      await supabase
        .from('purchase_order_items')
        .delete()
        .eq('purchase_order_id', id)

      // Then delete the purchase order
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting purchase order:', error)
      alert('Error deleting purchase order')
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status })
        .eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'text-green-700 bg-green-100'
      case 'approved': return 'text-blue-700 bg-blue-100'
      case 'sent': return 'text-purple-700 bg-purple-100'
      case 'cancelled': return 'text-red-700 bg-red-100'
      case 'draft': return 'text-yellow-700 bg-yellow-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch = po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         po.vendor?.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !statusFilter || po.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const { subtotal, taxAmount, total } = calculateTotals()

  if (loading && purchaseOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
        <button
          onClick={() => {
            resetForm()
            setEditingPO(null)
            setShowForm(true)
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Purchase Order
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search purchase orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="approved">Approved</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="flex justify-end">
            <ViewToggle viewType={viewType} onViewChange={setViewType} />
          </div>
        </div>
      </div>

      {/* Purchase Orders Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {viewType === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PO Number
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Date
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expected Delivery
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{po.po_number}</div>
                      {po.work_order && (
                        <div className="text-xs text-gray-500">
                          WO: {po.work_order.wo_number}
                        </div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{po.vendor?.name}</div>
                      {po.vendor?.contact_person && (
                        <div className="text-xs text-gray-500">{po.vendor.contact_person}</div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${po.total_amount.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={po.status}
                        onChange={(e) => updateStatus(po.id, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${getStatusColor(po.status)}`}
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="approved">Approved</option>
                        <option value="received">Received</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(po.order_date).toLocaleDateString()}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {po.expected_delivery ? new Date(po.expected_delivery).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedPO(po)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                          title="View Purchase Order"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEdit(po)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deletePO(po.id)} 
                          className="text-red-600 hover:text-red-800 p-1.5 transition-all duration-200 hover:bg-red-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPOs.map((po) => (
                <div key={po.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{po.po_number}</h3>
                      <p className="text-sm text-gray-600 mb-2">Vendor: {po.vendor?.name}</p>
                      <p className="text-lg font-bold text-green-600">${po.total_amount.toFixed(2)}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(po.status)}`}>
                      {po.status}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Order Date:</span> {new Date(po.order_date).toLocaleDateString()}
                    </div>
                    {po.expected_delivery && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Expected Delivery:</span> {new Date(po.expected_delivery).toLocaleDateString()}
                      </div>
                    )}
                    {po.work_order && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Work Order:</span> {po.work_order.wo_number}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      {po.items?.length || 0} items
                    </div>
                    <div className="flex space-x-3">
                      <button 
                        onClick={() => setSelectedPO(po)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                      >
                        View Details <ArrowRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPO ? 'Edit Purchase Order' : 'Create New Purchase Order'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Header Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PO Number *
                  </label>
                  <input
                    type="text"
                    value={formData.po_number}
                    onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="approved">Approved</option>
                    <option value="received">Received</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vendor *
                  </label>
                  <select
                    value={formData.vendor_id}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Related Work Order
                  </label>
                  <select
                    value={formData.work_order_id}
                    onChange={(e) => setFormData({ ...formData, work_order_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">None</option>
                    {workOrders.map((wo) => (
                      <option key={wo.id} value={wo.id}>
                        {wo.wo_number} - {wo.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Date *
                  </label>
                  <input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expected Delivery
                  </label>
                  <input
                    type="date"
                    value={formData.expected_delivery}
                    onChange={(e) => setFormData({ ...formData, expected_delivery: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-gray-900">Line Items</h4>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Item
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                          Unit Price
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {lineItems.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Item description"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              ${item.amount.toFixed(2)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => removeLineItem(index)}
                              className="text-red-600 hover:text-red-800"
                              disabled={lineItems.length === 1}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes and Totals */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional notes or terms..."
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Subtotal</span>
                    <span className="text-lg font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-700">Tax Rate</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.tax_rate}
                        onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                        className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                    <span className="text-lg font-semibold text-gray-900">${taxAmount.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <span className="text-lg font-bold text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-blue-600">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchase Order Detail Modal */}
      {selectedPO && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">
                  Purchase Order {selectedPO.po_number}
                </h3>
                <button
                  onClick={() => setSelectedPO(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Purchase Order Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Status:</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedPO.status)}`}>
                        {selectedPO.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Order Date:</span>
                      <span className="text-sm text-gray-900">{new Date(selectedPO.order_date).toLocaleDateString()}</span>
                    </div>
                    {selectedPO.expected_delivery && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Expected Delivery:</span>
                        <span className="text-sm text-gray-900">{new Date(selectedPO.expected_delivery).toLocaleDateString()}</span>
                      </div>
                    )}
                    {selectedPO.work_order && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Work Order:</span>
                        <span className="text-sm text-gray-900">{selectedPO.work_order.wo_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Vendor Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Vendor:</span>
                      <span className="text-sm text-gray-900">{selectedPO.vendor?.name}</span>
                    </div>
                    {selectedPO.vendor?.contact_person && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Contact Person:</span>
                        <span className="text-sm text-gray-900">{selectedPO.vendor.contact_person}</span>
                      </div>
                    )}
                    {selectedPO.vendor?.email && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Email:</span>
                        <span className="text-sm text-gray-900">{selectedPO.vendor.email}</span>
                      </div>
                    )}
                    {selectedPO.vendor?.phone && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Phone:</span>
                        <span className="text-sm text-gray-900">{selectedPO.vendor.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Line Items</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedPO.items && selectedPO.items.length > 0 ? (
                        selectedPO.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.description}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              ${item.unit_price.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              ${item.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                            No line items found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Subtotal</span>
                    <p className="text-lg font-semibold text-gray-900">${selectedPO.subtotal.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Tax</span>
                    <p className="text-lg font-semibold text-gray-900">${selectedPO.tax_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Total</span>
                    <p className="text-lg font-semibold text-gray-900">${selectedPO.total_amount.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedPO.notes && (
                <div className="mb-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Notes</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">{selectedPO.notes}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                {selectedPO.status === 'draft' && (
                  <>
                    <button
                      onClick={() => updateStatus(selectedPO.id, 'sent')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Mark as Sent
                    </button>
                    <button
                      onClick={() => startEdit(selectedPO)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Edit Purchase Order
                    </button>
                  </>
                )}
                {selectedPO.status === 'sent' && (
                  <button
                    onClick={() => updateStatus(selectedPO.id, 'received')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Mark as Received
                  </button>
                )}
                <button
                  onClick={() => setSelectedPO(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}