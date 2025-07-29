import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Search, 
  Calendar, 
  User, 
  MapPin, 
  Clock, 
  Edit, 
  Trash2, 
  Eye, 
  X, 
  Phone, 
  Mail,
  CheckCircle,
  AlertTriangle,
  Users,
  Camera,
  ShoppingCart,
  FileText,
  Package
} from 'lucide-react'
import { supabase, WorkOrder, Customer, Profile, CustomerSite } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'
import { getNextNumber, updateNextNumber } from '../lib/numbering'

interface WorkOrderWithDetails extends WorkOrder {
  customer?: Customer
  assigned_technician?: Profile
  customer_site?: CustomerSite
  assignments?: WorkOrderAssignment[]
  photos?: WorkOrderPhoto[]
  purchase_orders?: PurchaseOrder[]
}

interface WorkOrderAssignment {
  id: string
  work_order_id: string
  tech_id: string
  is_primary: boolean
  technician: Profile
}

interface WorkOrderPhoto {
  id: string
  work_order_id: string
  photo_url: string
  caption?: string
  uploaded_by?: string
  created_at: string
  uploader?: Profile
}

interface PurchaseOrder {
  id: string
  po_number: string
  vendor?: {
    name: string
  }
  total_amount: number
  status: string
  created_at: string
}

export default function WorkOrders() {
  const { viewType, setViewType } = useViewPreference('workOrders')
  const [workOrders, setWorkOrders] = useState<WorkOrderWithDetails[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<Profile[]>([])
  const [customerSites, setCustomerSites] = useState<CustomerSite[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrderWithDetails | null>(null)
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderWithDetails | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([])
  const [primaryTechnician, setPrimaryTechnician] = useState<string>('')
  const [loadingSites, setLoadingSites] = useState(false)

  const [formData, setFormData] = useState({
    wo_number: '',
    customer_id: '',
    customer_site_id: '',
    project_id: '',
    department_id: '',
    title: '',
    description: '',
    priority: 'medium',
    status: 'open',
    scheduled_date: '',
    work_type: '',
    notes: '',
    resolution_notes: ''
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
      const [workOrdersResult, customersResult, techniciansResult, projectsResult, departmentsResult] = await Promise.all([
        supabase
          .from('work_orders')
          .select(`
            *,
            customer:customers(*),
            assigned_technician:profiles!work_orders_assigned_to_fkey(*),
            customer_site:customer_sites(*),
            project:projects(*),
            assigned_dept:departments!department_id(*)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('first_name'),
        supabase.from('profiles').select('*').in('role', ['tech', 'admin', 'manager']).eq('is_active', true).order('first_name'),
        supabase.from('projects').select('*').order('project_name'),
        supabase.from('departments').select('*').eq('is_active', true).order('name')
      ])

      // Load additional details for each work order
      const workOrdersWithDetails = await Promise.all(
        (workOrdersResult.data || []).map(async (wo) => {
          // Load assignments
          const { data: assignments } = await supabase
            .from('work_order_assignments')
            .select(`
              *,
              technician:profiles!tech_id(*)
            `)
            .eq('work_order_id', wo.id)

          // Load photos
          const { data: photos } = await supabase
            .from('work_order_photos')
            .select(`
              *,
              uploader:profiles!uploaded_by(first_name, last_name)
            `)
            .eq('work_order_id', wo.id)
            .order('created_at', { ascending: false })

          // Load purchase orders
          const { data: purchaseOrders } = await supabase
            .from('purchase_orders')
            .select(`
              id,
              po_number,
              total_amount,
              status,
              created_at,
              vendor:vendors(name)
            `)
            .eq('work_order_id', wo.id)
            .order('created_at', { ascending: false })

          return {
            ...wo,
            assignments: assignments || [],
            photos: photos || [],
            purchase_orders: purchaseOrders || []
          }
        })
      )

      setWorkOrders(workOrdersWithDetails)
      setCustomers(customersResult.data || [])
      setTechnicians(techniciansResult.data || [])
      setProjects(projectsResult.data || [])
      setDepartments(departmentsResult.data || [])
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
        project_id: formData.project_id || null,
        department_id: formData.department_id || null,
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        status: formData.status,
        scheduled_date: formData.scheduled_date || null,
        work_type: formData.work_type || null,
        notes: formData.notes || null,
        resolution_notes: formData.resolution_notes || null
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
      project_id: '',
      department_id: '',
      title: '',
      description: '',
      priority: 'medium',
      status: 'open',
      scheduled_date: '',
      work_type: '',
      notes: '',
      resolution_notes: ''
    })
    setCustomerSites([])
  }

  const startEdit = (workOrder: WorkOrderWithDetails) => {
    setEditingWorkOrder(workOrder)
    setFormData({
      wo_number: workOrder.wo_number,
      customer_id: workOrder.customer_id,
      customer_site_id: workOrder.customer_site_id || '',
      project_id: workOrder.project_id || '',
      department_id: workOrder.department_id || '',
      title: workOrder.title,
      description: workOrder.description || '',
      priority: workOrder.priority,
      status: workOrder.status,
      scheduled_date: workOrder.scheduled_date ? workOrder.scheduled_date.slice(0, 16) : '',
      work_type: workOrder.work_type || '',
      notes: workOrder.notes || '',
      resolution_notes: workOrder.resolution_notes || ''
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

  const openAssignModal = (workOrder: WorkOrderWithDetails) => {
    setSelectedWorkOrder(workOrder)
    setSelectedTechnicians(workOrder.assignments?.map(a => a.tech_id) || [])
    setPrimaryTechnician(workOrder.assignments?.find(a => a.is_primary)?.tech_id || '')
    setShowAssignModal(true)
  }

  const handleMultiAssign = async () => {
    if (!selectedWorkOrder || selectedTechnicians.length === 0) return

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
        .eq('work_order_id', selectedWorkOrder.id)

      // Add new assignments
      const assignments = selectedTechnicians.map(techId => ({
        work_order_id: selectedWorkOrder.id,
        tech_id: techId,
        is_primary: techId === primaryTechnician,
        company_id: profile.company_id
      }))

      const { error } = await supabase
        .from('work_order_assignments')
        .insert(assignments)

      if (error) throw error

      setShowAssignModal(false)
      setSelectedWorkOrder(null)
      setSelectedTechnicians([])
      setPrimaryTechnician('')
      loadData()
    } catch (error) {
      console.error('Error assigning technicians:', error)
    }
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
      case 'urgent': return 'text-red-700 bg-red-100 border-red-200'
      case 'high': return 'text-orange-700 bg-orange-100 border-orange-200'
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-200'
      case 'low': return 'text-green-700 bg-green-100 border-green-200'
      default: return 'text-gray-700 bg-gray-100 border-gray-200'
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
        <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scheduled
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Photos/POs
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
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(workOrder.priority)}`}>
                        {workOrder.priority}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {workOrder.customer?.customer_type === 'residential' 
                          ? `${workOrder.customer?.first_name} ${workOrder.customer?.last_name}`
                          : workOrder.customer?.company_name
                        }
                      </div>
                      {workOrder.customer_site && (
                        <div className="text-xs text-gray-500">{workOrder.customer_site.site_name}</div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      {workOrder.assignments && workOrder.assignments.length > 0 ? (
                        <div className="space-y-1">
                          {workOrder.assignments.map((assignment) => (
                            <div key={assignment.id} className="text-sm">
                              <span className={assignment.is_primary ? 'font-medium text-gray-900' : 'text-gray-600'}>
                                {assignment.technician.first_name} {assignment.technician.last_name}
                              </span>
                              {assignment.is_primary && (
                                <span className="ml-1 text-xs text-blue-600">(Primary)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : workOrder.assigned_technician ? (
                        <div className="text-sm text-gray-900">
                          {workOrder.assigned_technician.first_name} {workOrder.assigned_technician.last_name}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Unassigned</span>
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
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {workOrder.scheduled_date ? new Date(workOrder.scheduled_date).toLocaleDateString() : 'Not scheduled'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-3 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Camera className="w-3 h-3 mr-1" />
                          {workOrder.photos?.length || 0}
                        </span>
                        <span className="flex items-center">
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          {workOrder.purchase_orders?.length || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedWorkOrder(workOrder)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(currentUser?.profile?.role === 'admin' || currentUser?.profile?.role === 'manager' || currentUser?.profile?.role === 'office') && (
                          <>
                            <button
                              onClick={() => openAssignModal(workOrder)}
                              className="text-purple-600 hover:text-purple-800 p-1.5 transition-all duration-200 hover:bg-purple-100 rounded-full hover:shadow-sm transform hover:scale-110"
                              title="Assign Technicians"
                            >
                              <Users className="w-4 h-4" />
                            </button>
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
                <div key={workOrder.id} className={`border-2 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer ${getPriorityColor(workOrder.priority)}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{workOrder.wo_number}</h3>
                      <p className="text-sm text-gray-600 mb-2">{workOrder.title}</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workOrder.status)}`}>
                        {workOrder.status.replace('_', ' ').toUpperCase()}
                      </span>
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
                    
                    {workOrder.scheduled_date && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-3" />
                        <span>{new Date(workOrder.scheduled_date).toLocaleDateString()}</span>
                      </div>
                    )}

                    {workOrder.assignments && workOrder.assignments.length > 0 && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="w-4 h-4 mr-3" />
                        <div>
                          {workOrder.assignments.map((assignment, index) => (
                            <span key={assignment.id} className={assignment.is_primary ? 'font-medium' : ''}>
                              {assignment.technician.first_name} {assignment.technician.last_name}
                              {assignment.is_primary && ' (Primary)'}
                              {index < workOrder.assignments!.length - 1 && ', '}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center">
                        <Camera className="w-3 h-3 mr-1" />
                        {workOrder.photos?.length || 0} photos
                      </span>
                      <span className="flex items-center">
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        {workOrder.purchase_orders?.length || 0} POs
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="text-blue-600 text-sm font-medium">
                      Click to view details →
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Work Order Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingWorkOrder ? 'Edit Work Order' : 'Create New Work Order'}
                </h3>
                <div className="text-sm text-blue-600 font-medium">
                  WO Number: {formData.wo_number}
                </div>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
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
                    Project
                  </label>
                  <select
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No Project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.project_number} - {project.project_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Work Type
                  </label>
                  <input
                    type="text"
                    value={formData.work_type}
                    onChange={(e) => setFormData({ ...formData, work_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Installation, Repair, Maintenance"
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

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resolution Notes
                  </label>
                  <textarea
                    value={formData.resolution_notes}
                    onChange={(e) => setFormData({ ...formData, resolution_notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Notes about work performed, issues resolved, etc."
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

      {/* Work Order Detail Modal */}
      {selectedWorkOrder && !showAssignModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Work Order {selectedWorkOrder.wo_number}
                  </h3>
                  <p className="text-gray-600">{selectedWorkOrder.title}</p>
                </div>
                <button
                  onClick={() => setSelectedWorkOrder(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Work Order Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Status:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedWorkOrder.status)}`}>
                          {selectedWorkOrder.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Priority:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(selectedWorkOrder.priority)}`}>
                          {selectedWorkOrder.priority.toUpperCase()}
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
                  </div>

                  {/* Customer Information */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h4>
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
                      {selectedWorkOrder.customer?.email && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Email:</span>
                          <span className="text-sm text-gray-900">{selectedWorkOrder.customer.email}</span>
                        </div>
                      )}
                      {selectedWorkOrder.customer?.phone && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Phone:</span>
                          <span className="text-sm text-gray-900">{selectedWorkOrder.customer.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Assigned Technicians */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Assigned Technicians</h4>
                    {selectedWorkOrder.assignments && selectedWorkOrder.assignments.length > 0 ? (
                      <div className="space-y-2">
                        {selectedWorkOrder.assignments.map((assignment) => (
                          <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {assignment.technician.first_name} {assignment.technician.last_name}
                                </p>
                                <p className="text-xs text-gray-500">{assignment.technician.role}</p>
                              </div>
                            </div>
                            {assignment.is_primary && (
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                Primary
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : selectedWorkOrder.assigned_technician ? (
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedWorkOrder.assigned_technician.first_name} {selectedWorkOrder.assigned_technician.last_name}
                          </p>
                          <p className="text-xs text-gray-500">{selectedWorkOrder.assigned_technician.role}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No technicians assigned</p>
                    )}
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Description */}
                  {selectedWorkOrder.description && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-4">Description</h4>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700">{selectedWorkOrder.description}</p>
                      </div>
                    </div>
                  )}

                  {/* Resolution Notes */}
                  {selectedWorkOrder.resolution_notes && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-4">Resolution Notes</h4>
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700">{selectedWorkOrder.resolution_notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Photos */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                      Photos ({selectedWorkOrder.photos?.length || 0})
                    </h4>
                    {selectedWorkOrder.photos && selectedWorkOrder.photos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {selectedWorkOrder.photos.map((photo) => (
                          <div key={photo.id} className="relative group">
                            <img
                              src={photo.photo_url}
                              alt={photo.caption || 'Work order photo'}
                              className="w-full h-32 object-cover rounded-lg border border-gray-200"
                            />
                            {photo.caption && (
                              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-2 rounded-b-lg">
                                {photo.caption}
                              </div>
                            )}
                            <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                              {photo.uploader ? `${photo.uploader.first_name} ${photo.uploader.last_name}` : 'Unknown'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Camera className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No photos uploaded</p>
                      </div>
                    )}
                  </div>

                  {/* Purchase Orders */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                      Purchase Orders ({selectedWorkOrder.purchase_orders?.length || 0})
                    </h4>
                    {selectedWorkOrder.purchase_orders && selectedWorkOrder.purchase_orders.length > 0 ? (
                      <div className="space-y-3">
                        {selectedWorkOrder.purchase_orders.map((po) => (
                          <div key={po.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h5 className="font-medium text-gray-900">{po.po_number}</h5>
                                <p className="text-sm text-gray-600">{po.vendor?.name}</p>
                                <p className="text-xs text-gray-500">
                                  Created: {new Date(po.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-gray-900">${po.total_amount.toFixed(2)}</p>
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  po.status === 'received' ? 'bg-green-100 text-green-800' :
                                  po.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                  po.status === 'sent' ? 'bg-purple-100 text-purple-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {po.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No purchase orders created</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedWorkOrder.notes && (
                <div className="mt-8">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Notes</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">{selectedWorkOrder.notes}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                {(currentUser?.profile?.role === 'admin' || currentUser?.profile?.role === 'manager' || currentUser?.profile?.role === 'office') && (
                  <button
                    onClick={() => startEdit(selectedWorkOrder)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Edit Work Order
                  </button>
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

      {/* Multi-Assignment Modal */}
      {showAssignModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Assign Technicians to {selectedWorkOrder.wo_number}
                </h3>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Select Technicians</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {technicians.map((tech) => (
                      <div
                        key={tech.id}
                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedTechnicians.includes(tech.id)
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          if (selectedTechnicians.includes(tech.id)) {
                            setSelectedTechnicians(selectedTechnicians.filter(id => id !== tech.id))
                            if (primaryTechnician === tech.id) {
                              setPrimaryTechnician('')
                            }
                          } else {
                            setSelectedTechnicians([...selectedTechnicians, tech.id])
                          }
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {tech.first_name} {tech.last_name}
                            </p>
                            <p className="text-xs text-gray-500">{tech.role}</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedTechnicians.includes(tech.id)}
                          onChange={() => {}}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTechnicians.length > 1 && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">Primary Technician</h4>
                    <select
                      value={primaryTechnician}
                      onChange={(e) => setPrimaryTechnician(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Primary Technician</option>
                      {selectedTechnicians.map((techId) => {
                        const tech = technicians.find(t => t.id === techId)
                        return tech ? (
                          <option key={tech.id} value={tech.id}>
                            {tech.first_name} {tech.last_name}
                          </option>
                        ) : null
                      })}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMultiAssign}
                  disabled={selectedTechnicians.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Assign {selectedTechnicians.length} Technician{selectedTechnicians.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}