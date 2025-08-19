import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Search, 
  Calendar, 
  User, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Edit, 
  Trash2, 
  Eye, 
  X, 
  UserPlus, 
  Users, 
  Building2, 
  Camera, 
  Upload, 
  Download,
  FileText,
  Phone,
  Mail
} from 'lucide-react'
import { supabase, WorkOrder, Customer, Profile, CustomerSite } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'
import { getNextNumber, updateNextNumber } from '../lib/numbering'

interface WorkOrdersProps {
  selectedRecordId?: string | null
  onRecordViewed?: () => void
}

export default function WorkOrders({ selectedRecordId, onRecordViewed }: WorkOrdersProps = {}) {
  const { viewType, setViewType } = useViewPreference('workOrders')
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [customerSites, setCustomerSites] = useState<CustomerSite[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrder | null>(null)
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [assignmentWorkOrder, setAssignmentWorkOrder] = useState<WorkOrder | null>(null)
  const [assignmentMode, setAssignmentMode] = useState<'individual' | 'team'>('individual')
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [primaryTechnician, setPrimaryTechnician] = useState('')
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([])
  const [photoCaption, setPhotoCaption] = useState('')
  const [workOrderPhotos, setWorkOrderPhotos] = useState<any[]>([])
  const [loadingSites, setLoadingSites] = useState(false)

  const [formData, setFormData] = useState({
    wo_number: '',
    title: '',
    description: '',
    customer_id: '',
    customer_site_id: '',
    priority: 'medium',
    status: 'open',
    scheduled_date: '',
    notes: '',
    department_id: '',
    work_type: ''
  })

  useEffect(() => {
    getCurrentUser()
    loadData()
  }, [])

  useEffect(() => {
    // Auto-open detail modal if selectedRecordId is provided
    if (selectedRecordId && workOrders.length > 0) {
      const workOrder = workOrders.find(wo => wo.id === selectedRecordId)
      if (workOrder) {
        setSelectedWorkOrder(workOrder)
        onRecordViewed?.()
      }
    }
  }, [selectedRecordId, workOrders, onRecordViewed])

  useEffect(() => {
    // Auto-open detail modal if selectedRecordId is provided
    if (selectedRecordId && workOrders.length > 0) {
      const workOrder = workOrders.find(wo => wo.id === selectedRecordId)
      if (workOrder) {
        setSelectedWorkOrder(workOrder)
        onRecordViewed?.()
      }
    }
  }, [selectedRecordId, workOrders, onRecordViewed])

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
      const [ordersResult, customersResult, techsResult, deptsResult] = await Promise.all([
        supabase
          .from('work_orders')
          .select(`
            *,
            customer:customers(*),
            assigned_technician:profiles!work_orders_assigned_to_fkey(*),
            project:projects(*),
            assigned_dept:departments!department_id(*),
            assignments:work_order_assignments(
              id,
              tech_id,
              is_primary,
              tech:profiles(*)
            ),
            customer_site:customer_sites(*)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('first_name'),
        supabase.from('profiles').select('*').in('role', ['tech', 'admin', 'manager']).eq('is_active', true).order('first_name'),
        supabase.from('departments').select('*').eq('is_active', true).order('name')
      ])

      setWorkOrders(ordersResult.data || [])
      setCustomers(customersResult.data || [])
      setTechnicians(techsResult.data || [])
      setDepartments(deptsResult.data || [])
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
        title: formData.title,
        description: formData.description || null,
        customer_id: formData.customer_id,
        customer_site_id: formData.customer_site_id || null,
        priority: formData.priority,
        status: formData.status,
        scheduled_date: formData.scheduled_date || null,
        notes: formData.notes || null,
        department_id: formData.department_id || null,
        work_type: formData.work_type || null
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
      title: '',
      description: '',
      customer_id: '',
      customer_site_id: '',
      priority: 'medium',
      status: 'open',
      scheduled_date: '',
      notes: '',
      department_id: '',
      work_type: ''
    })
    setCustomerSites([])
  }

  const startEdit = (workOrder: WorkOrder) => {
    setEditingWorkOrder(workOrder)
    setFormData({
      wo_number: workOrder.wo_number,
      title: workOrder.title,
      description: workOrder.description || '',
      customer_id: workOrder.customer_id,
      customer_site_id: workOrder.customer_site_id || '',
      priority: workOrder.priority,
      status: workOrder.status,
      scheduled_date: workOrder.scheduled_date ? workOrder.scheduled_date.slice(0, 16) : '',
      notes: workOrder.notes || '',
      department_id: workOrder.department_id || '',
      work_type: workOrder.work_type || ''
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

  const openAssignmentModal = (workOrder: WorkOrder, mode: 'individual' | 'team') => {
    setAssignmentWorkOrder(workOrder)
    setAssignmentMode(mode)
    
    // Pre-populate with existing assignments
    if (workOrder.assignments && workOrder.assignments.length > 0) {
      const techIds = workOrder.assignments.map(a => a.tech_id)
      setSelectedTechnicians(techIds)
      
      const primary = workOrder.assignments.find(a => a.is_primary)
      if (primary) {
        setPrimaryTechnician(primary.tech_id)
      }
    } else {
      setSelectedTechnicians([])
      setPrimaryTechnician('')
    }
    
    setSelectedDepartment(workOrder.department_id || '')
    setShowAssignmentModal(true)
  }

  const handleAssignment = async () => {
    if (!assignmentWorkOrder) return

    try {
      if (assignmentMode === 'team' && selectedDepartment) {
        // Assign entire department
        const { error: updateError } = await supabase
          .from('work_orders')
          .update({ department_id: selectedDepartment })
          .eq('id', assignmentWorkOrder.id)

        if (updateError) throw updateError

        // Get department members
        const { data: members } = await supabase
          .from('department_members')
          .select('user_id')
          .eq('department_id', selectedDepartment)

        if (members && members.length > 0) {
          // Clear existing assignments
          await supabase
            .from('work_order_assignments')
            .delete()
            .eq('work_order_id', assignmentWorkOrder.id)

          // Create new assignments for all department members
          const assignments = members.map((member, index) => ({
            work_order_id: assignmentWorkOrder.id,
            tech_id: member.user_id,
            is_primary: index === 0, // First member is primary
            company_id: assignmentWorkOrder.company_id
          }))

          const { error: assignError } = await supabase
            .from('work_order_assignments')
            .insert(assignments)

          if (assignError) throw assignError
        }
      } else if (assignmentMode === 'individual' && selectedTechnicians.length > 0) {
        // Clear existing assignments
        await supabase
          .from('work_order_assignments')
          .delete()
          .eq('work_order_id', assignmentWorkOrder.id)

        // Create new assignments
        const assignments = selectedTechnicians.map(techId => ({
          work_order_id: assignmentWorkOrder.id,
          tech_id: techId,
          is_primary: techId === primaryTechnician,
          company_id: assignmentWorkOrder.company_id
        }))

        const { error: assignError } = await supabase
          .from('work_order_assignments')
          .insert(assignments)

        if (assignError) throw assignError
      }

      setShowAssignmentModal(false)
      setAssignmentWorkOrder(null)
      setSelectedTechnicians([])
      setSelectedDepartment('')
      setPrimaryTechnician('')
      loadData()
    } catch (error) {
      console.error('Error handling assignment:', error)
      alert('Error assigning work order: ' + (error as Error).message)
    }
  }

  const openPhotoModal = async (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder)
    await loadWorkOrderPhotos(workOrder.id)
    setShowPhotoModal(true)
  }

  const loadWorkOrderPhotos = async (workOrderId: string) => {
    try {
      const { data, error } = await supabase
        .from('work_order_photos')
        .select(`
          *,
          uploaded_by_profile:profiles!uploaded_by(first_name, last_name)
        `)
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setWorkOrderPhotos(data || [])
    } catch (error) {
      console.error('Error loading photos:', error)
    }
  }

  const handlePhotoUpload = async () => {
    if (!selectedWorkOrder || selectedPhotos.length === 0) return

    try {
      setLoading(true)

      for (const photo of selectedPhotos) {
        // In a real app, you would upload to storage first
        // For now, we'll use a placeholder URL
        const photoUrl = `https://via.placeholder.com/400x300?text=Photo+${Date.now()}`

        const { error } = await supabase
          .from('work_order_photos')
          .insert([{
            work_order_id: selectedWorkOrder.id,
            company_id: selectedWorkOrder.company_id,
            photo_url: photoUrl,
            caption: photoCaption || null,
            uploaded_by: currentUser?.id
          }])

        if (error) throw error
      }

      setSelectedPhotos([])
      setPhotoCaption('')
      await loadWorkOrderPhotos(selectedWorkOrder.id)
    } catch (error) {
      console.error('Error uploading photos:', error)
      alert('Error uploading photos')
    } finally {
      setLoading(false)
    }
  }

  const deletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return

    try {
      const { error } = await supabase
        .from('work_order_photos')
        .delete()
        .eq('id', photoId)

      if (error) throw error

      if (selectedWorkOrder) {
        await loadWorkOrderPhotos(selectedWorkOrder.id)
      }
    } catch (error) {
      console.error('Error deleting photo:', error)
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <FileText className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
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
            <AlertTriangle className="w-8 h-8 text-red-600" />
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
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
                  <tr key={workOrder.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedWorkOrder(workOrder)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{workOrder.wo_number}</div>
                      <div className="text-sm text-gray-500">{workOrder.title}</div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(workOrder.priority)}`}>
                        {workOrder.priority} priority
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
                      <div className="text-sm text-gray-900">
                        {workOrder.assignments && workOrder.assignments.length > 0 ? (
                          <div>
                            {workOrder.assignments.map((assignment, index) => (
                              <div key={assignment.id} className="flex items-center">
                                <span className={`text-xs ${assignment.is_primary ? 'font-semibold text-blue-600' : 'text-gray-600'}`}>
                                  {assignment.tech?.first_name} {assignment.tech?.last_name}
                                  {assignment.is_primary && ' (Primary)'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : workOrder.assigned_dept ? (
                          <div className="flex items-center">
                            <Building2 className="w-4 h-4 mr-1 text-blue-600" />
                            <span className="text-sm text-blue-600">{workOrder.assigned_dept.name}</span>
                          </div>
                        ) : (
                          'Unassigned'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={workOrder.status}
                        onChange={(e) => {
                          e.stopPropagation()
                          updateStatus(workOrder.id, e.target.value)
                        }}
                        className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${getStatusColor(workOrder.status)}`}
                        disabled={currentUser?.profile?.role === 'tech' && workOrder.assigned_to !== currentUser?.id}
                      >
                        <option value="open">Open</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {workOrder.scheduled_date ? new Date(workOrder.scheduled_date).toLocaleString() : 'Not scheduled'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {order.status === 'completed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              convertToInvoice(order)
                            }}
                            className="text-green-600 hover:text-green-800 p-1.5 transition-all duration-200 hover:bg-green-100 rounded-full hover:shadow-sm transform hover:scale-110"
                            title="Convert to Invoice"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        {(currentUser?.profile?.role === 'admin' || currentUser?.profile?.role === 'manager' || currentUser?.profile?.role === 'office') && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openAssignmentModal(workOrder, 'individual')
                              }}
                              className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                              title="Assign Technician(s)"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openAssignmentModal(workOrder, 'team')
                              }}
                              className="text-purple-600 hover:text-purple-800 p-1.5 transition-all duration-200 hover:bg-purple-100 rounded-full hover:shadow-sm transform hover:scale-110"
                              title="Assign Team/Department"
                            >
                              <Users className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openPhotoModal(workOrder)
                          }}
                          className="text-green-600 hover:text-green-800 p-1.5 transition-all duration-200 hover:bg-green-100 rounded-full hover:shadow-sm transform hover:scale-110"
                          title="Photos"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedWorkOrder(workOrder)
                          }}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startEdit(workOrder)
                          }}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteWorkOrder(workOrder.id)
                          }}
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
              {filteredWorkOrders.map((workOrder) => (
                <div key={workOrder.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedWorkOrder(workOrder)}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{workOrder.wo_number}</h3>
                      <p className="text-sm text-gray-600 mb-2">{workOrder.title}</p>
                      <div className="flex space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workOrder.status)}`}>
                          {workOrder.status.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(workOrder.priority)}`}>
                          {workOrder.priority.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Building2 className="w-4 h-4 mr-3" />
                      <span>
                        {workOrder.customer?.customer_type === 'residential' 
                          ? `${workOrder.customer?.first_name} ${workOrder.customer?.last_name}`
                          : workOrder.customer?.company_name
                        }
                      </span>
                    </div>
                    
                    {workOrder.customer_site && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Building2 className="w-4 h-4 mr-3" />
                        <span>{workOrder.customer_site.site_name}</span>
                      </div>
                    )}
                    
                    {workOrder.assignments && workOrder.assignments.length > 0 ? (
                      <div className="flex items-center text-sm text-gray-600">
                        <User className="w-4 h-4 mr-3" />
                        <div>
                          {workOrder.assignments.map((assignment, index) => (
                            <div key={assignment.id}>
                              <span className={assignment.is_primary ? 'font-semibold text-blue-600' : ''}>
                                {assignment.tech?.first_name} {assignment.tech?.last_name}
                                {assignment.is_primary && ' (Primary)'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : workOrder.assigned_dept ? (
                      <div className="flex items-center text-sm text-gray-600">
                        <Building2 className="w-4 h-4 mr-3" />
                        <span className="text-blue-600">{workOrder.assigned_dept.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-sm text-gray-600">
                        <User className="w-4 h-4 mr-3" />
                        <span>Unassigned</span>
                      </div>
                    )}
                    
                    {workOrder.scheduled_date && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-3" />
                        <span>{new Date(workOrder.scheduled_date).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="flex space-x-2">
                      {(currentUser?.profile?.role === 'admin' || currentUser?.profile?.role === 'manager' || currentUser?.profile?.role === 'office') && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openAssignmentModal(workOrder, 'individual')
                            }}
                            className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
                          >
                            <UserPlus className="w-4 h-4 mr-1" />
                            Assign
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openAssignmentModal(workOrder, 'team')
                            }}
                            className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors text-sm"
                          >
                            <Users className="w-4 h-4 mr-1" />
                            Team
                          </button>
                        </>
                      )}
                    </div>
                    <div className="text-blue-600 text-sm font-medium">
                      Click to view →
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
                    Work Type
                  </label>
                  <input
                    type="text"
                    value={formData.work_type}
                    onChange={(e) => setFormData({ ...formData, work_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., HVAC, Plumbing, Electrical"
                  />
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
      {showAssignmentModal && assignmentWorkOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {assignmentMode === 'team' ? 'Assign Team/Department' : 'Assign Technician(s)'} - {assignmentWorkOrder.wo_number}
                </h3>
                <button
                  onClick={() => setShowAssignmentModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {assignmentMode === 'team' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Department
                  </label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-500 mt-2">
                    This will assign all members of the selected department to this work order.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Select Technician(s)
                  </label>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
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
                            <span className="text-blue-600 font-medium text-sm">
                              {tech.first_name[0]}{tech.last_name[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {tech.first_name} {tech.last_name}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">{tech.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {selectedTechnicians.includes(tech.id) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setPrimaryTechnician(tech.id)
                              }}
                              className={`px-2 py-1 text-xs rounded ${
                                primaryTechnician === tech.id
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-600 hover:bg-yellow-100'
                              }`}
                            >
                              {primaryTechnician === tech.id ? 'Primary' : 'Set Primary'}
                            </button>
                          )}
                          <input
                            type="checkbox"
                            checked={selectedTechnicians.includes(tech.id)}
                            onChange={() => {}}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {selectedTechnicians.length > 1 && (
                    <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Multi-technician assignment:</strong> Select a primary technician who will be the main contact for this work order.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAssignmentModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignment}
                  disabled={
                    (assignmentMode === 'team' && !selectedDepartment) ||
                    (assignmentMode === 'individual' && selectedTechnicians.length === 0)
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {assignmentMode === 'team' ? 'Assign Department' : 'Assign Technician(s)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Photos - {selectedWorkOrder.wo_number}
                </h3>
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Upload Section */}
              <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Upload Photos</h4>
                  <p className="text-gray-600 mb-4">Add photos to document work progress</p>
                  
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files) {
                        setSelectedPhotos(Array.from(e.target.files))
                      }
                    }}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Select Photos
                  </label>
                  
                  {selectedPhotos.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-600 mb-2">
                        {selectedPhotos.length} photo(s) selected
                      </p>
                      <input
                        type="text"
                        placeholder="Add a caption (optional)"
                        value={photoCaption}
                        onChange={(e) => setPhotoCaption(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                      />
                      <button
                        onClick={handlePhotoUpload}
                        disabled={loading}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {loading ? 'Uploading...' : 'Upload Photos'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Existing Photos */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Existing Photos</h4>
                {workOrderPhotos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workOrderPhotos.map((photo) => (
                      <div key={photo.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <img
                          src={photo.photo_url}
                          alt={photo.caption || 'Work order photo'}
                          className="w-full h-48 object-cover"
                        />
                        <div className="p-3">
                          {photo.caption && (
                            <p className="text-sm text-gray-900 mb-2">{photo.caption}</p>
                          )}
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>
                              {photo.uploaded_by_profile ? 
                                `${photo.uploaded_by_profile.first_name} ${photo.uploaded_by_profile.last_name}` : 
                                'Unknown'
                              }
                            </span>
                            <span>{new Date(photo.created_at).toLocaleDateString()}</span>
                          </div>
                          {(currentUser?.profile?.role === 'admin' || photo.uploaded_by === currentUser?.id) && (
                            <button
                              onClick={() => deletePhoto(photo.id)}
                              className="mt-2 text-red-600 hover:text-red-800 text-sm"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Camera className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No photos uploaded yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Work Order Detail Modal */}
      {selectedWorkOrder && !showPhotoModal && (
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
                        {selectedWorkOrder.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Priority:</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedWorkOrder.priority)}`}>
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
                          <div>
                            {selectedWorkOrder.assignments.map((assignment) => (
                              <div key={assignment.id} className="flex items-center">
                                <span className={assignment.is_primary ? 'font-semibold text-blue-600' : ''}>
                                  {assignment.tech?.first_name} {assignment.tech?.last_name}
                                  {assignment.is_primary && ' (Primary)'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : selectedWorkOrder.assigned_dept ? (
                          <div className="flex items-center">
                            <Building2 className="w-4 h-4 mr-1 text-blue-600" />
                            <span className="text-blue-600">{selectedWorkOrder.assigned_dept.name}</span>
                          </div>
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
                            <Mail className="w-4 h-4 mr-2" />
                            <span>{selectedWorkOrder.customer.email}</span>
                          </div>
                        )}
                        {selectedWorkOrder.customer.phone && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="w-4 h-4 mr-2" />
                            <span>{selectedWorkOrder.customer.phone}</span>
                          </div>
                        )}
                        {selectedWorkOrder.customer.address && (
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="w-4 h-4 mr-2" />
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
                <button
                  onClick={() => openPhotoModal(selectedWorkOrder)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Camera className="w-4 h-4 mr-2 inline" />
                  Manage Photos
                </button>
                <button
                  onClick={() => startEdit(selectedWorkOrder)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit Work Order
                </button>
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