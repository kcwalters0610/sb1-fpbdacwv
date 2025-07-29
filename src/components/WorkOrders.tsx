import React, { useState, useEffect } from 'react'
import { Plus, Search, Calendar, User, Clock, Edit, Trash2, Eye, X, MapPin, Phone, Mail, Users, CheckCircle, AlertTriangle, ArrowRight, DollarSign } from 'lucide-react'
import { FileText } from 'lucide-react'
import { supabase, WorkOrder, Customer, Profile, CustomerSite } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'
import { getNextNumber, updateNextNumber } from '../lib/numbering'

export default function WorkOrders() {
  const { viewType, setViewType } = useViewPreference('workOrders')
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<Profile[]>([])
  const [customerSites, setCustomerSites] = useState<CustomerSite[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrder | null>(null)
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedWOForAssign, setSelectedWOForAssign] = useState<WorkOrder | null>(null)
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loadingSites, setLoadingSites] = useState(false)

  const [formData, setFormData] = useState({
    wo_number: '',
    customer_id: '',
    customer_site_id: '',
    title: '',
    description: '',
    priority: 'medium',
    status: 'open',
    scheduled_date: '',
    work_type: '',
    notes: ''
  })

  useEffect(() => {
    getCurrentUser()
    loadData()
  }, [])

  useEffect(() => {
    // Generate WO number when form opens
    if (showForm && !editingWorkOrder) {
      generateWONumber()
    }
  }, [showForm, editingWorkOrder])

  useEffect(() => {
    // Load customer sites when customer changes
    if (formData.customer_id) {
      loadCustomerSites(formData.customer_id)
    } else {
      setCustomerSites([])
      setFormData(prev => ({ ...prev, customer_site_id: '' }))
    }
  }, [formData.customer_id])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        setCurrentUser({ ...user, profile })
      }
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const generateWONumber = async () => {
    try {
      const { formattedNumber: woNumber } = await getNextNumber('work_order')
      setFormData(prev => ({ ...prev, wo_number: woNumber }))
    } catch (error) {
      console.error('Error generating WO number:', error)
    }
  }

  const loadData = async () => {
    try {
      const [workOrdersResult, customersResult, techniciansResult] = await Promise.all([
        supabase
          .from('work_orders')
          .select(`
            *,
            customer:customers(*),
            assigned_technician:profiles!work_orders_assigned_to_fkey(*),
            customer_site:customer_sites(*),
            invoices:invoices!work_order_id(*),
            assignments:work_order_assignments(
              id,
              tech_id,
              is_primary,
              technician:profiles!tech_id(*)
            )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('first_name'),
        supabase.from('profiles').select('*').in('role', ['tech', 'admin', 'manager']).order('first_name')
      ])

      setWorkOrders(workOrdersResult.data || [])
      setCustomers(customersResult.data || [])
      setTechnicians(techniciansResult.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCustomerSites = async (customerId: string) => {
    try {
      setLoadingSites(true)
      const { data, error } = await supabase
        .from('customer_sites')
        .select('*')
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('site_name')

      if (error) throw error
      setCustomerSites(data || [])
    } catch (error) {
      console.error('Error loading customer sites:', error)
      setCustomerSites([])
    } finally {
      setLoadingSites(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

      const workOrderData = {
        company_id: profile.company_id,
        wo_number: formData.wo_number,
        customer_id: formData.customer_id,
        customer_site_id: formData.customer_site_id || null,
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        status: formData.status,
        scheduled_date: formData.scheduled_date || null,
        work_type: formData.work_type || null,
        notes: formData.notes || null
      }

      if (editingWorkOrder) {
        const { error } = await supabase
          .from('work_orders')
          .update(workOrderData)
          .eq('id', editingWorkOrder.id)
        if (error) throw error
      } else {
        const { formattedNumber: woNumber, nextSequence } = await getNextNumber('work_order')
        workOrderData.wo_number = woNumber
        
        const { error } = await supabase
          .from('work_orders')
          .insert([workOrderData])
        if (error) throw error
        
        // Update the sequence number
        await updateNextNumber('work_order', nextSequence)
      }

      setShowForm(false)
      setEditingWorkOrder(null)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving work order:', error)
      alert('Error saving work order: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      wo_number: '',
      customer_id: '',
      customer_site_id: '',
      title: '',
      description: '',
      priority: 'medium',
      status: 'open',
      scheduled_date: '',
      work_type: '',
      notes: ''
    })
    setCustomerSites([])
  }

  const startEdit = (workOrder: WorkOrder) => {
    setEditingWorkOrder(workOrder)
    setFormData({
      wo_number: workOrder.wo_number,
      customer_id: workOrder.customer_id,
      customer_site_id: workOrder.customer_site_id || '',
      title: workOrder.title,
      description: workOrder.description || '',
      priority: workOrder.priority,
      status: workOrder.status,
      scheduled_date: workOrder.scheduled_date ? workOrder.scheduled_date.slice(0, 16) : '',
      work_type: workOrder.work_type || '',
      notes: workOrder.notes || ''
    })
    
    // Load customer sites for the selected customer
    if (workOrder.customer_id) {
      loadCustomerSites(workOrder.customer_id)
    }
    
    setShowForm(true)
  }

  const deleteWorkOrder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this work order?')) return

    try {
     // First delete associated time entries to avoid foreign key constraint violation
     const { error: timeEntriesError } = await supabase
       .from('time_entries')
       .delete()
       .eq('work_order_id', id)
     
     if (timeEntriesError) throw timeEntriesError
     
     // Now delete the work order
      const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting work order:', error)
    }
  }

  const convertToInvoice = async (workOrder: WorkOrder) => {
    if (!confirm(`Convert work order "${workOrder.wo_number}" to an invoice?`)) return

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

      // Generate invoice number
      const { formattedNumber: invoiceNumber, nextSequence } = await getNextNumber('invoice')
      
      // Create invoice from work order
      const invoiceData = {
        company_id: profile.company_id,
        customer_id: workOrder.customer_id,
        work_order_id: workOrder.id,
        invoice_number: invoiceNumber,
        status: 'draft',
        issue_date: new Date().toISOString().split('T')[0],
        subtotal: 0, // Will need to be filled in manually
        tax_rate: 0,
        tax_amount: 0,
        total_amount: 0,
        paid_amount: 0,
        notes: `Invoice created from work order: ${workOrder.wo_number}`
      }

      const { error } = await supabase
        .from('invoices')
        .insert([invoiceData])
      
      if (error) throw error
      
      // Update the sequence number
      await updateNextNumber('invoice', nextSequence)

      alert(`Invoice ${invoiceNumber} created successfully from work order ${workOrder.wo_number}!`)
      loadData() // Refresh the work orders to update billing status
    } catch (error) {
      console.error('Error converting to invoice:', error)
      alert('Error converting work order to invoice: ' + (error as Error).message)
    }
  }
  const updateStatus = async (id: string, status: string) => {
    try {
      const updateData: any = { status }
      if (status === 'completed') {
        updateData.completed_date = new Date().toISOString()
      }

      const { error } = await supabase
        .from('work_orders')
        .update(updateData)
        .eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const openAssignModal = (workOrder: WorkOrder) => {
    setSelectedWOForAssign(workOrder)
    setSelectedTechnicians(workOrder.assignments?.map(a => a.tech_id) || [])
    setShowAssignModal(true)
  }

  const handleAssignTechnicians = async () => {
    if (!selectedWOForAssign) return

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

      // Remove existing assignments
      await supabase
        .from('work_order_assignments')
        .delete()
        .eq('work_order_id', selectedWOForAssign.id)

      // Add new assignments
      if (selectedTechnicians.length > 0) {
        const assignments = selectedTechnicians.map((techId, index) => ({
          work_order_id: selectedWOForAssign.id,
          tech_id: techId,
          is_primary: index === 0, // First selected tech is primary
          company_id: profile.company_id
        }))

        const { error } = await supabase
          .from('work_order_assignments')
          .insert(assignments)
        if (error) throw error
      }

      setShowAssignModal(false)
      setSelectedWOForAssign(null)
      setSelectedTechnicians([])
      loadData()
    } catch (error) {
      console.error('Error assigning technicians:', error)
      alert('Error assigning technicians')
    }
  }

  const toggleTechnicianSelection = (techId: string) => {
    setSelectedTechnicians(prev => 
      prev.includes(techId) 
        ? prev.filter(id => id !== techId)
        : [...prev, techId]
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-700 bg-green-100'
      case 'in_progress': return 'text-blue-700 bg-blue-100'
      case 'scheduled': return 'text-purple-700 bg-purple-100'
      case 'cancelled': return 'text-red-700 bg-red-100'
      case 'open': return 'text-yellow-700 bg-yellow-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-700 bg-red-100'
      case 'high': return 'text-orange-700 bg-orange-100'
      case 'medium': return 'text-yellow-700 bg-yellow-100'
      case 'low': return 'text-green-700 bg-green-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  const filteredWorkOrders = workOrders.filter(workOrder => {
    const matchesSearch = workOrder.wo_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workOrder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (workOrder.customer?.customer_type === 'residential' 
                           ? `${workOrder.customer?.first_name} ${workOrder.customer?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
                           : workOrder.customer?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
                         )
    const matchesStatus = !statusFilter || workOrder.status === statusFilter
    const matchesPriority = !priorityFilter || workOrder.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })

  if (loading && workOrders.length === 0) {
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
          <p className="text-gray-600">Manage all work orders in the system</p>
        </div>
        {(currentUser?.profile?.role === 'admin' || currentUser?.profile?.role === 'manager' || currentUser?.profile?.role === 'office') && (
          <button
            onClick={() => {
              resetForm()
              setEditingWorkOrder(null)
              setShowForm(true)
            }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Work Order
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Work Orders</p>
              <p className="text-2xl font-bold text-gray-900">{workOrders.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-gray-900">{workOrders.filter(wo => wo.status === 'in_progress').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{workOrders.filter(wo => wo.status === 'completed').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Urgent</p>
              <p className="text-2xl font-bold text-gray-900">{workOrders.filter(wo => wo.priority === 'urgent').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search work orders..."
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
            <option value="open">Open</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <div className="flex justify-end">
            <ViewToggle viewType={viewType} onViewChange={setViewType} />
          </div>
        </div>
      </div>

      {/* Work Orders Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {viewType === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Work Order
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Billing Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scheduled
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWorkOrders.map((workOrder) => (
                  <tr key={workOrder.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{workOrder.wo_number}</div>
                      <div className="text-sm text-gray-500">{workOrder.title}</div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {workOrder.customer?.customer_type === 'residential' 
                          ? `${workOrder.customer?.first_name} ${workOrder.customer?.last_name}`
                          : workOrder.customer?.company_name || 'Unknown Customer'
                        }
                      </div>
                      {workOrder.customer_site && (
                        <div className="text-xs text-gray-500">{workOrder.customer_site.site_name}</div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {workOrder.assignments && workOrder.assignments.length > 0 ? (
                          <div>
                            {workOrder.assignments.map((assignment, index) => (
                              <div key={assignment.id} className="flex items-center">
                                <span className={assignment.is_primary ? 'font-semibold' : ''}>
                                  {assignment.technician?.first_name} {assignment.technician?.last_name}
                                </span>
                                {assignment.is_primary && (
                                  <span className="ml-1 text-xs text-blue-600">(Primary)</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          'Unassigned'
                        )}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      {workOrder.invoices && workOrder.invoices.length > 0 ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full text-green-700 bg-green-100">
                          Invoiced
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full text-orange-700 bg-orange-100">
                          Not Invoiced
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={workOrder.status}
                        onChange={(e) => updateStatus(workOrder.id, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${getStatusColor(workOrder.status)}`}
                        disabled={currentUser?.profile?.role === 'tech'}
                      >
                        <option value="open">Open</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(workOrder.priority)}`}>
                        {workOrder.priority}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {workOrder.scheduled_date ? 
                        new Date(workOrder.scheduled_date).toLocaleDateString() : 
                        '-'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {(currentUser?.profile?.role === 'admin' || currentUser?.profile?.role === 'manager' || currentUser?.profile?.role === 'office') && (
                          <button
                            onClick={() => openAssignModal(workOrder)}
                            className="text-purple-600 hover:text-purple-800 p-1.5 transition-all duration-200 hover:bg-purple-100 rounded-full hover:shadow-sm transform hover:scale-110"
                            title="Assign Technicians"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                        )}
                        {(currentUser?.profile?.role === 'admin' || currentUser?.profile?.role === 'manager' || currentUser?.profile?.role === 'office') && workOrder.status === 'completed' && (
                          <button
                            onClick={() => convertToInvoice(workOrder)}
                            className="text-green-600 hover:text-green-800 p-1.5 transition-all duration-200 hover:bg-green-100 rounded-full hover:shadow-sm transform hover:scale-110"
                            title="Convert to Invoice"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedWorkOrder(workOrder)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(currentUser?.profile?.role === 'admin' || currentUser?.profile?.role === 'manager' || currentUser?.profile?.role === 'office') && (
                          <>
                            <button
                              onClick={() => startEdit(workOrder)}
                              className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteWorkOrder(workOrder.id)}
                              className="text-red-600 hover:text-red-800 p-1.5 transition-all duration-200 hover:bg-red-100 rounded-full hover:shadow-sm transform hover:scale-110"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
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
              {filteredWorkOrders.map((workOrder) => (
                <div key={workOrder.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{workOrder.wo_number}</h3>
                      <p className="text-sm text-gray-600 mb-2">{workOrder.title}</p>
                      <div className="flex space-x-2">
                        {workOrder.status === 'completed' && 
                         (!workOrder.invoices || workOrder.invoices.length === 0) &&
                         (currentUser?.profile?.role === 'admin' || 
                          currentUser?.profile?.role === 'manager' || 
                          currentUser?.profile?.role === 'office') && (
                          <button
                            onClick={() => convertToInvoice(workOrder)}
                            className="text-green-600 hover:text-green-800 p-1.5 transition-all duration-200 hover:bg-green-100 rounded-full hover:shadow-sm transform hover:scale-110"
                            title="Convert to Invoice"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workOrder.status)}`}>
                          {workOrder.status}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(workOrder.priority)}`}>
                          {workOrder.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="w-4 h-4 mr-3" />
                      <span>
                        {workOrder.customer?.customer_type === 'residential' 
                          ? `${workOrder.customer?.first_name} ${workOrder.customer?.last_name}`
                          : workOrder.customer?.company_name
                        }
                      </span>
                    </div>
                    
                    {workOrder.customer_site && (
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mr-3" />
                        <span>{workOrder.customer_site.site_name}</span>
                      </div>
                    )}
                    
                    {workOrder.assignments && workOrder.assignments.length > 0 && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="w-4 h-4 mr-3" />
                        <div>
                          {workOrder.assignments.map((assignment, index) => (
                            <div key={assignment.id}>
                              {assignment.technician?.first_name} {assignment.technician?.last_name}
                              {assignment.is_primary && <span className="text-blue-600"> (Primary)</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {workOrder.scheduled_date && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-3" />
                        <span>{new Date(workOrder.scheduled_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      Created {new Date(workOrder.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex space-x-3">
                      {(currentUser?.profile?.role === 'admin' || currentUser?.profile?.role === 'manager' || currentUser?.profile?.role === 'office') && workOrder.status === 'completed' && (
                        <button
                          onClick={() => convertToInvoice(workOrder)}
                          className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm"
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          Invoice
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedWorkOrder(workOrder)}
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
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingWorkOrder ? 'Edit Work Order' : 'Create New Work Order'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Work Order Number
                  </label>
                  <input
                    type="text"
                    value={formData.wo_number}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer *
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.customer_type === 'residential' 
                          ? `${customer.first_name} ${customer.last_name}`
                          : customer.company_name
                        }
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Site
                  </label>
                  <select
                    value={formData.customer_site_id}
                    onChange={(e) => setFormData({ ...formData, customer_site_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!formData.customer_id}
                  >
                    <option value="">Main Location</option>
                    {loadingSites ? (
                      <option disabled>Loading sites...</option>
                    ) : customerSites.length > 0 ? (
                      customerSites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.site_name}
                        </option>
                      ))
                    ) : (
                      formData.customer_id && <option disabled>No additional sites found</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
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
                    <option value="open">Open</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheduled Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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
                  {loading ? 'Saving...' : (editingWorkOrder ? 'Update Work Order' : 'Create Work Order')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && selectedWOForAssign && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Assign Technicians - {selectedWOForAssign.wo_number}
              </h3>
            </div>
            
            <div className="p-6">
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {technicians.map((tech) => (
                  <div
                    key={tech.id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedTechnicians.includes(tech.id)
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => toggleTechnicianSelection(tech.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {tech.first_name} {tech.last_name}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{tech.role}</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedTechnicians.includes(tech.id)}
                      onChange={() => toggleTechnicianSelection(tech.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignTechnicians}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Assign Technicians
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Work Order Detail Modal */}
      {selectedWorkOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  Work Order {selectedWorkOrder.wo_number}
                </h3>
                <button
                  onClick={() => setSelectedWorkOrder(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Work Order Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Title:</span>
                      <span className="text-sm text-gray-900">{selectedWorkOrder.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Status:</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedWorkOrder.status)}`}>
                        {selectedWorkOrder.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Priority:</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedWorkOrder.priority)}`}>
                        {selectedWorkOrder.priority}
                      </span>
                    </div>
                    {selectedWorkOrder.scheduled_date && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Scheduled:</span>
                        <span className="text-sm text-gray-900">
                          {new Date(selectedWorkOrder.scheduled_date).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedWorkOrder.work_type && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Work Type:</span>
                        <span className="text-sm text-gray-900">{selectedWorkOrder.work_type}</span>
                      </div>
                    )}
                  </div>

                  {selectedWorkOrder.description && (
                    <div className="mt-6">
                      <h5 className="text-md font-medium text-gray-900 mb-3">Description</h5>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700">{selectedWorkOrder.description}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Customer & Assignment</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Customer:</span>
                      <span className="text-sm text-gray-900">
                        {selectedWorkOrder.customer?.customer_type === 'residential' 
                          ? `${selectedWorkOrder.customer?.first_name} ${selectedWorkOrder.customer?.last_name}`
                          : selectedWorkOrder.customer?.company_name
                        }
                      </span>
                    </div>
                    {selectedWorkOrder.customer_site && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Site:</span>
                        <span className="text-sm text-gray-900">{selectedWorkOrder.customer_site.site_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Assigned To:</span>
                      <div className="text-sm text-gray-900">
                        {selectedWorkOrder.assignments && selectedWorkOrder.assignments.length > 0 ? (
                          selectedWorkOrder.assignments.map((assignment) => (
                            <div key={assignment.id}>
                              {assignment.technician?.first_name} {assignment.technician?.last_name}
                              {assignment.is_primary && <span className="text-blue-600"> (Primary)</span>}
                            </div>
                          ))
                        ) : (
                          'Unassigned'
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedWorkOrder.customer && (
                    <div className="mt-6">
                      <h5 className="text-md font-medium text-gray-900 mb-3">Customer Contact</h5>
                      <div className="space-y-2">
                        {selectedWorkOrder.customer.email && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="w-4 h-4 mr-3" />
                            <span>{selectedWorkOrder.customer.email}</span>
                          </div>
                        )}
                        {selectedWorkOrder.customer.phone && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="w-4 h-4 mr-3" />
                            <span>{selectedWorkOrder.customer.phone}</span>
                          </div>
                        )}
                        {selectedWorkOrder.customer.address && (
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="w-4 h-4 mr-3" />
                            <span>{selectedWorkOrder.customer.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedWorkOrder.notes && (
                <div className="mt-8">
                  <h5 className="text-md font-medium text-gray-900 mb-3">Notes</h5>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">{selectedWorkOrder.notes}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                {(currentUser?.profile?.role === 'admin' || currentUser?.profile?.role === 'manager' || currentUser?.profile?.role === 'office') && (
                  <>
                    {selectedWorkOrder.status === 'completed' && (
                      <button
                        onClick={() => convertToInvoice(selectedWorkOrder)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Convert to Invoice
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(selectedWorkOrder)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Edit Work Order
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedWorkOrder(null)}
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