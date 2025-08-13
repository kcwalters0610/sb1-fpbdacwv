import React, { useEffect, useState } from 'react'
import {
  Plus, Search, DollarSign, Calendar, User, FileText,
  Edit, Trash2, Eye, X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'
import { getNextNumber, updateNextNumber } from '../lib/numbering'

type POStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled'

interface PurchaseOrder {
  id: string
  company_id: string
  vendor_id: string
  work_order_id?: string | null
  po_number: string
  status: POStatus
  order_date: string
  expected_date?: string | null
  subtotal: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  paid_amount: number
  payment_date?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  vendor?: any
  work_order?: any
}

export default function PurchaseOrders() {
  const { viewType, setViewType } = useViewPreference('purchase_orders')

  const [pos, setPOs] = useState<PurchaseOrder[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<POStatus | ''>('')

  // Numbering fallback — if generation fails, allow manual number typing
  const [numberingError, setNumberingError] = useState<string>('') 
  const [allowManualNumber, setAllowManualNumber] = useState(false)

  const [formData, setFormData] = useState({
    po_number: '',
    vendor_id: '',
    work_order_id: '',
    status: 'draft' as POStatus,
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    subtotal: '',
    tax_rate: '0',
    notes: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (showForm && !editingPO) generatePONumber()
  }, [showForm, editingPO])

  const generatePONumber = async () => {
    setNumberingError('')
    setAllowManualNumber(false)
    try {
      const { formattedNumber } = await getNextNumber('purchase_order')
      setFormData(prev => ({ ...prev, po_number: formattedNumber }))
    } catch (e: any) {
      console.error('Error generating PO number:', e)
      setNumberingError(e?.message || 'Unable to generate PO number from settings.')
      setAllowManualNumber(true)
    }
  }

  const loadData = async () => {
    try {
      const [posResult, vendorsResult, workOrdersResult] = await Promise.all([
        supabase.from('purchase_orders').select(`
          *,
          vendor:vendors(*),
          work_order:work_orders(*)
        `).order('created_at', { ascending: false }),
        supabase.from('vendors').select('*').order('name'),
        supabase.from('work_orders').select('id, wo_number, title').order('created_at', { ascending: false })
      ])
      setPOs(posResult.data || [])
      setVendors(vendorsResult.data || [])
      setWorkOrders(workOrdersResult.data || [])
    } catch (e) {
      console.error('Error loading POs:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()
      if (!profile) throw new Error('User profile not found')

      const subtotal = parseFloat(formData.subtotal) || 0
      const taxRate = parseFloat(formData.tax_rate) || 0
      const taxAmount = (subtotal * taxRate) / 100
      const totalAmount = subtotal + taxAmount

      const poData: any = {
        company_id: profile.company_id,
        vendor_id: formData.vendor_id,
        work_order_id: formData.work_order_id || null,
        po_number: formData.po_number, // will be overwritten for new creates using settings
        status: formData.status,
        order_date: formData.order_date,
        expected_date: formData.expected_date || null,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        paid_amount: 0,
        notes: formData.notes || null
      }

      if (editingPO) {
        const { error } = await supabase.from('purchase_orders')
          .update(poData)
          .eq('id', editingPO.id)
        if (error) throw error
      } else {
        // Re-read next number at submit-time to avoid collisions
        let formattedNumber = formData.po_number
        let nextSequence: number | null = null

        if (!allowManualNumber) {
          const res = await getNextNumber('purchase_order')
          formattedNumber = res.formattedNumber
          nextSequence = res.nextSequence
        } else if (!formattedNumber) {
          throw new Error('PO Number is required.')
        }

        poData.po_number = formattedNumber
        const { error } = await supabase.from('purchase_orders').insert([poData])
        if (error) throw error

        if (nextSequence) {
          // Only bump if we actually used auto-numbering
          await updateNextNumber('purchase_order', nextSequence)
        }
      }

      setShowForm(false)
      setEditingPO(null)
      resetForm()
      loadData()
    } catch (e: any) {
      console.error('Error saving PO:', e)
      alert('Error saving purchase order: ' + e.message)
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
      expected_date: '',
      subtotal: '',
      tax_rate: '0',
      notes: ''
    })
    setNumberingError('')
    setAllowManualNumber(false)
  }

  const startEdit = (po: PurchaseOrder) => {
    setEditingPO(po)
    setFormData({
      po_number: po.po_number,
      vendor_id: po.vendor_id,
      work_order_id: po.work_order_id || '',
      status: po.status,
      order_date: po.order_date,
      expected_date: po.expected_date || '',
      subtotal: po.subtotal.toString(),
      tax_rate: po.tax_rate.toString(),
      notes: po.notes || ''
    })
    setNumberingError('')
    setAllowManualNumber(true) // editing: allow number to be editable if needed
    setShowForm(true)
  }

  const deletePO = async (id: string) => {
    if (!confirm('Delete this purchase order?')) return
    try {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
      if (error) throw error
      loadData()
    } catch (e) {
      console.error('Error deleting PO:', e)
    }
  }

  const updateStatus = async (id: string, status: POStatus) => {
    try {
      const updateData: any = { status }
      if (status === 'received') {
        updateData.payment_date = new Date().toISOString().split('T')[0]
      }
      const { error } = await supabase.from('purchase_orders').update(updateData).eq('id', id)
      if (error) throw error
      loadData()
    } catch (e) {
      console.error('Error updating status:', e)
    }
  }

  const getStatusColor = (status: POStatus) => {
    switch (status) {
      case 'received': return 'text-green-700 bg-green-100'
      case 'ordered': return 'text-blue-700 bg-blue-100'
      case 'partially_received': return 'text-yellow-700 bg-yellow-100'
      case 'cancelled': return 'text-gray-700 bg-gray-100'
      case 'draft': default: return 'text-gray-700 bg-gray-100'
    }
  }

  const filteredPOs = pos.filter(po => {
    const term = searchTerm.toLowerCase()
    const vendorName =
      po.vendor?.name ||
      po.vendor?.company_name ||
      [po.vendor?.first_name, po.vendor?.last_name].filter(Boolean).join(' ')
    const matchesSearch =
      po.po_number?.toLowerCase().includes(term) ||
      (vendorName ? vendorName.toLowerCase().includes(term) : false)
    const matchesStatus = !statusFilter || po.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalOrdered = pos.reduce((sum, po) => sum + po.total_amount, 0)
  const receivedAmount = pos
    .filter(po => po.status === 'received' || po.status === 'partially_received')
    .reduce((sum, po) => sum + po.total_amount, 0)
  const outstanding = totalOrdered - receivedAmount

  if (loading && pos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Open the "Create PO" form prefilled from a Work Order
const openCreateFromWO = (payload: WOPrefill) => {
  // Make sure we’re in create mode
  setEditingPO(null)
  setAllowManualNumber(false)
  setNumberingError('')

  // Prefill: link WO + a helpful note. Vendor left for user to pick.
  setFormData(prev => ({
    ...prev,
    work_order_id: payload.work_order.id || '',
    notes:
      prev.notes?.trim() ||
      `PO created from Work Order ${payload.work_order.wo_number} — ${payload.work_order.title}`,
    // Keep order_date default; number will be auto-generated by your existing useEffect
  }))

  setShowForm(true)
}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
        <button
          onClick={() => { resetForm(); setEditingPO(null); setShowForm(true) }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create PO
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <DollarSign className="w-8 h-8" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Ordered</p>
              <p className="text-2xl font-bold text-gray-900">${totalOrdered.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <FileText className="w-8 h-8" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Received</p>
              <p className="text-2xl font-bold text-gray-900">${receivedAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <Calendar className="w-8 h-8" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">${outstanding.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search POs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as POStatus | '')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="ordered">Ordered</option>
            <option value="partially_received">Partially Received</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="flex justify-end">
            <ViewToggle viewType={viewType} onViewChange={setViewType} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {viewType === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{po.po_number}</div>
                      <div className="text-sm text-gray-500">{new Date(po.order_date).toLocaleDateString()}</div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {po.vendor?.name || po.vendor?.company_name ||
                          [po.vendor?.first_name, po.vendor?.last_name].filter(Boolean).join(' ')}
                      </div>
                      {po.work_order && (
                        <div className="text-xs text-gray-500">WO: {po.work_order.wo_number}</div>
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
                        onChange={(e) => updateStatus(po.id, e.target.value as POStatus)}
                        className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${getStatusColor(po.status)}`}
                      >
                        <option value="draft">Draft</option>
                        <option value="ordered">Ordered</option>
                        <option value="partially_received">Partially Received</option>
                        <option value="received">Received</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedPO(po)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
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
                      <p className="text-2xl font-bold text-blue-600 mb-2">${po.total_amount.toFixed(2)}</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(po.status)}`}>
                        {po.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="w-4 h-4 mr-3" />
                      <span>
                        {po.vendor?.name || po.vendor?.company_name ||
                          [po.vendor?.first_name, po.vendor?.last_name].filter(Boolean).join(' ')}
                      </span>
                    </div>

                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-3" />
                      <span>Expected: {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '—'}</span>
                    </div>

                    {po.work_order && (
                      <div className="flex items-center text-sm text-gray-600">
                        <FileText className="w-4 h-4 mr-3" />
                        <span>WO: {po.work_order.wo_number}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      Ordered: {new Date(po.order_date).toLocaleDateString()}
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={() => setSelectedPO(po)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View
                      </button>
                      <button onClick={() => startEdit(po)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        Edit
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
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPO ? 'Edit Purchase Order' : 'Create New Purchase Order'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {numberingError && !editingPO && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
                  {numberingError} — you can enter a PO number manually below.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PO Number</label>
                  <input
                    type="text"
                    value={formData.po_number}
                    onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${allowManualNumber ? '' : 'bg-gray-100 text-gray-700'}`}
                    readOnly={!allowManualNumber}
                    placeholder="PO-2025-0001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as POStatus })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="draft">Draft</option>
                    <option value="ordered">Ordered</option>
                    <option value="partially_received">Partially Received</option>
                    <option value="received">Received</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vendor *</label>
                  <select
                    value={formData.vendor_id}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name || v.company_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Related Work Order</label>
                  <select
                    value={formData.work_order_id}
                    onChange={(e) => setFormData({ ...formData, work_order_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">None</option>
                    {workOrders.map((wo) => (
                      <option key={wo.id} value={wo.id}>{wo.wo_number} - {wo.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Order Date *</label>
                  <input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expected Date</label>
                  <input
                    type="date"
                    value={formData.expected_date}
                    onChange={(e) => setFormData({ ...formData, expected_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subtotal *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.subtotal}
                    onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Totals Preview */}
              {formData.subtotal && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Subtotal:</span>
                      <span className="text-sm text-gray-900">${parseFloat(formData.subtotal || '0').toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Tax ({formData.tax_rate}%):</span>
                      <span className="text-sm text-gray-900">
                        ${((parseFloat(formData.subtotal || '0') * parseFloat(formData.tax_rate || '0')) / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-lg font-bold text-gray-900">Total:</span>
                      <span className="text-lg font-bold text-blue-600">
                        {(parseFloat(formData.subtotal || '0') +
                          ((parseFloat(formData.subtotal || '0') * parseFloat(formData.tax_rate || '0')) / 100)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
                  {loading ? 'Saving...' : (editingPO ? 'Update PO' : 'Create PO')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedPO && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  PO {selectedPO.po_number}
                </h3>
                <button onClick={() => setSelectedPO(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Order Information</h4>
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
                    {selectedPO.expected_date && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Expected:</span>
                        <span className="text-sm text-gray-900">{new Date(selectedPO.expected_date).toLocaleDateString()}</span>
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
                      <span className="text-sm text-gray-900">
                        {selectedPO.vendor?.name || selectedPO.vendor?.company_name ||
                          [selectedPO.vendor?.first_name, selectedPO.vendor?.last_name].filter(Boolean).join(' ')}
                      </span>
                    </div>
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
                    {selectedPO.vendor?.address && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Address:</span>
                        <span className="text-sm text-gray-900">{selectedPO.vendor.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="mt-8 bg-gray-50 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Financial Summary</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700">Subtotal:</span>
                    <span className="text-sm text-gray-900">${selectedPO.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700">Tax ({selectedPO.tax_rate}%):</span>
                    <span className="text-sm text-gray-900">${selectedPO.tax_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-gray-200">
                    <span className="text-lg font-bold text-gray-900">Total:</span>
                    <span className="text-lg font-bold text-gray-900">${selectedPO.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedPO.notes && (
                <div className="mt-6">
                  <h5 className="text-md font-medium text-gray-900 mb-3">Notes</h5>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">{selectedPO.notes}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => startEdit(selectedPO)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit PO
                </button>
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

