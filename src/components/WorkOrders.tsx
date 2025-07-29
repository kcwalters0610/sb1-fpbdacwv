import React, { useState, useEffect } from 'react'
import { Plus, Search, Calendar, User, AlertTriangle, Edit, Trash2, Eye, X, Camera, Timer, ShoppingCart, FileText, Clock, CheckCircle, Play, Square, Upload, Mail, Phone, MapPin } from 'lucide-react'
import { supabase, WorkOrder, Customer, Profile, CustomerSite } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'
import { getNextNumber, updateNextNumber } from '../lib/numbering'

interface TimeEntry {
  id: string
  start_time: string
  end_time?: string
  duration_minutes: number
  description: string
  status: 'pending' | 'approved' | 'rejected'
}

interface WorkOrderPhoto {
  id: string
  photo_url: string
  caption?: string
  uploaded_by: string
  created_at: string
}

interface PurchaseOrder {
  id: string
  po_number: string
  vendor: {
    name: string
  }
  total_amount: number
  status: string
  order_date: string
  expected_delivery?: string
}

export default function WorkOrders() {
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
  const [loadingSites, setLoadingSites] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  // Detail modal states
  const [activeTab, setActiveTab] = useState('details')
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [photos, setPhotos] = useState<WorkOrderPhoto[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [uploading, setUploading] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [photoCaption, setPhotoCaption] = useState('')
  
  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [currentTimeEntry, setCurrentTimeEntry] = useState<any>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  const [formData, setFormData] = useState({
    wo_number: '',
    customer_id: '',
    customer_site_id: '',
    assigned_to: '',
    department_id: '',
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

  useEffect(() => {
    if (selectedWorkOrder) {
      loadTimeEntries()
      loadPhotos()
      loadPurchaseOrders()
    }
  }, [selectedWorkOrder])

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isTimerRunning && currentTimeEntry) {
      interval = setInterval(() => {
        const startTime = new Date(currentTimeEntry.start_time)
        const now = new Date()
        setElapsedTime(Math.floor((now.getTime() - startTime.getTime()) / 1000))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isTimerRunning, currentTimeEntry])

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
      const [workOrdersResult, customersResult, techniciansResult, departmentsResult] = await Promise.all([
        supabase
          .from('work_orders')
          .select(`
            *,
            customer:customers(*),
            assigned_technician:profiles!work_orders_assigned_to_fkey(*),
            project:projects(*),
            assigned_dept:departments!department_id(*),
            customer_site:customer_sites(*)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('first_name'),
        supabase.from('profiles').select('*').order('first_name'),
        supabase.from('departments').select('*').eq('is_active', true).order('name')
      ])

      setWorkOrders(workOrdersResult.data || [])
      setCustomers(customersResult.data || [])
      setTechnicians(techniciansResult.data || [])
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

  const loadTimeEntries = async () => {
    if (!selectedWorkOrder) return

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('work_order_id', selectedWorkOrder.id)
        .order('start_time', { ascending: false })

      if (error) throw error
      setTimeEntries(data || [])

      // Check if there's an active timer
      const activeEntry = data?.find(entry => !entry.end_time)
      if (activeEntry) {
        setCurrentTimeEntry(activeEntry)
        setIsTimerRunning(true)
      }
    } catch (error) {
      console.error('Error loading time entries:', error)
    }
  }

  const loadPhotos = async () => {
    if (!selectedWorkOrder) return

    try {
      const { data, error } = await supabase
        .from('work_order_photos')
        .select('*')
        .eq('work_order_id', selectedWorkOrder.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPhotos(data || [])
    } catch (error) {
      console.error('Error loading photos:', error)
    }
  }

  const loadPurchaseOrders = async () => {
    if (!selectedWorkOrder) return

    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          total_amount,
          status,
          order_date,
          expected_delivery,
          vendor:vendors(name)
        `)
        .eq('work_order_id', selectedWorkOrder.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPurchaseOrders(data || [])
    } catch (error) {
      console.error('Error loading purchase orders:', error)
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
        assigned_to: formData.assigned_to || null,
        department_id: formData.department_id || null,
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
      assigned_to: '',
      department_id: '',
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
      assigned_to: workOrder.assigned_to || '',
      department_id: workOrder.department_id || '',
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
    if (!confirm('Are you sure you want to delete this work order? This will also delete all associated time entries.')) return

    try {
      // First delete associated time entries
      const { error: timeEntriesError } = await supabase
        .from('time_entries')
        .delete()
        .eq('work_order_id', id)

      if (timeEntriesError) throw timeEntriesError

      // Then delete the work order
      const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', id)
      if (error) throw error
      
      // Close detail modal if this work order was selected
      if (selectedWorkOrder?.id === id) {
        setSelectedWorkOrder(null)
      }
      
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
      
      // Update selected work order if it's the one being updated
      if (selectedWorkOrder?.id === id) {
        setSelectedWorkOrder({ ...selectedWorkOrder, status })
      }
      
      loadData()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const startTimer = async () => {
    if (!selectedWorkOrder || !currentUser) return

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.id)
        .single()

      if (!profile) return

      const { data, error } = await supabase
        .from('time_entries')
        .insert([{
          user_id: currentUser.id,
          company_id: profile.company_id,
          work_order_id: selectedWorkOrder.id,
          start_time: new Date().toISOString(),
          description: `Working on ${selectedWorkOrder.title}`,
          entry_type: 'work',
          status: 'pending',
          duration_minutes: 0
        }])
        .select()
        .single()

      if (error) throw error

      setCurrentTimeEntry(data)
      setIsTimerRunning(true)
      setElapsedTime(0)
    } catch (error) {
      console.error('Error starting timer:', error)
    }
  }

  const stopTimer = async () => {
    if (!currentTimeEntry) return

    try {
      const endTime = new Date()
      const startTime = new Date(currentTimeEntry.start_time)
      const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60))

      const { error } = await supabase
        .from('time_entries')
        .update({
          end_time: endTime.toISOString(),
          duration_minutes: durationMinutes
        })
        .eq('id', currentTimeEntry.id)

      if (error) throw error

      setIsTimerRunning(false)
      setCurrentTimeEntry(null)
      setElapsedTime(0)
      loadTimeEntries()
    } catch (error) {
      console.error('Error stopping timer:', error)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedWorkOrder || !currentUser) return

    setUploading(true)

    try {
      // Get company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.id)
        .single()

      if (!profile) throw new Error('Profile not found')

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${selectedWorkOrder.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('work-order-photos')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('work-order-photos')
        .getPublicUrl(fileName)

      // Save photo record
      const { error: insertError } = await supabase
        .from('work_order_photos')
        .insert([{
          work_order_id: selectedWorkOrder.id,
          company_id: profile.company_id,
          photo_url: publicUrl,
          caption: photoCaption || null,
          uploaded_by: currentUser.id
        }])

      if (insertError) throw insertError

      setPhotoCaption('')
      setShowPhotoModal(false)
      loadPhotos()
    } catch (error) {
      console.error('Error uploading photo:', error)
      alert('Error uploading photo')
    } finally {
      setUploading(false)
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
      loadPhotos()
    } catch (error) {
      console.error('Error deleting photo:', error)
    }
  }

  const createPurchaseOrder = () => {
    if (!selectedWorkOrder) return
    
    // Store the work order ID in localStorage to pre-select it in the PO form
    localStorage.setItem('preselected_work_order', selectedWorkOrder.id)
    
    // Navigate to purchase orders page
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'purchase-orders' }))
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-700 bg-green-100'
      case 'in_progress': return 'text-blue-700 bg-blue-100'
      case 'scheduled': return 'text-purple-700 bg-purple-100'
      case 'open': return 'text-yellow-700 bg-yellow-100'
      case 'cancelled': return 'text-red-700 bg-red-100'
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

  const getPOStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'text-green-700 bg-green-100'
      case 'approved': return 'text-blue-700 bg-blue-100'
      case 'sent': return 'text-purple-700 bg-purple-100'
      case 'cancelled': return 'text-red-700 bg-red-100'
      case 'draft': return 'text-yellow-700 bg-yellow-100'
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
            <Calendar className="w-8 h-8 text-blue-600" />
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
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Urgent Priority</p>
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
                          : workOrder.customer?.company_name
                        }
                      </div>
                      {workOrder.customer_site && (
                        <div className="text-xs text-gray-500">{workOrder.customer_site.site_name}</div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {workOrder.assigned_technician ? 
                          `${workOrder.assigned_technician.first_name} ${workOrder.assigned_technician.last_name}` : 
                          workOrder.assigned_dept?.name || 'Unassigned'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={workOrder.status}
                        onChange={(e) => updateStatus(workOrder.id, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${getStatusColor(workOrder.status)}`}
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
                      {workOrder.scheduled_date ? new Date(workOrder.scheduled_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedWorkOrder(workOrder)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
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
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workOrder.status)}`}>
                          {workOrder.status.replace('_', ' ')}
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
                    
                    {workOrder.assigned_technician && (
                      <div className="flex items-center text-sm text-gray-600">
                        <User className="w-4 h-4 mr-3" />
                        <span>{workOrder.assigned_technician.first_name} {workOrder.assigned_technician.last_name}</span>
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
                      Created: {new Date(workOrder.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedWorkOrder(workOrder)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => startEdit(workOrder)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
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
                    Assigned To
                  </label>
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Unassigned</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.first_name} {tech.last_name} ({tech.role})
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
                    Scheduled Date & Time
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
                    placeholder="e.g., Installation, Maintenance, Repair"
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

      {/* Work Order Detail Modal */}
      {selectedWorkOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-screen overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedWorkOrder.wo_number}</h2>
                  <p className="text-gray-600 mt-1">{selectedWorkOrder.title}</p>
                  <div className="flex items-center mt-3 space-x-4">
                    <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedWorkOrder.status)}`}>
                      {selectedWorkOrder.status.replace('_', ' ')}
                    </span>
                    {selectedWorkOrder.priority && (
                      <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getPriorityColor(selectedWorkOrder.priority)}`}>
                        {selectedWorkOrder.priority} priority
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {/* Status Update Buttons */}
                  {selectedWorkOrder.status === 'scheduled' && (
                    <button
                      onClick={() => updateStatus(selectedWorkOrder.id, 'in_progress')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Start Job
                    </button>
                  )}
                  {selectedWorkOrder.status === 'in_progress' && (
                    <button
                      onClick={() => updateStatus(selectedWorkOrder.id, 'completed')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Complete Job
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedWorkOrder(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {[
                  { id: 'details', name: 'Job Details', icon: FileText },
                  { id: 'time', name: 'Time Tracking', icon: Timer },
                  { id: 'photos', name: 'Photos', icon: Camera },
                  { id: 'purchase-orders', name: 'Purchase Orders', icon: ShoppingCart }
                ].map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.name}</span>
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Job Details Tab */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Job Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Customer Details</h4>
                        <div className="space-y-2">
                          <div className="flex items-center text-sm text-gray-600">
                            <User className="w-4 h-4 mr-3" />
                            {selectedWorkOrder.customer?.customer_type === 'residential' 
                              ? `${selectedWorkOrder.customer?.first_name} ${selectedWorkOrder.customer?.last_name}`
                              : selectedWorkOrder.customer?.company_name
                            }
                          </div>
                          {selectedWorkOrder.customer?.email && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Mail className="w-4 h-4 mr-3" />
                              <a href={`mailto:${selectedWorkOrder.customer.email}`} className="text-blue-600 hover:text-blue-800">
                                {selectedWorkOrder.customer.email}
                              </a>
                            </div>
                          )}
                          {selectedWorkOrder.customer?.phone && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Phone className="w-4 h-4 mr-3" />
                              <a href={`tel:${selectedWorkOrder.customer.phone}`} className="text-blue-600 hover:text-blue-800">
                                {selectedWorkOrder.customer.phone}
                              </a>
                            </div>
                          )}
                          {(selectedWorkOrder.customer?.address || selectedWorkOrder.customer_site?.address) && (
                            <div className="flex items-center text-sm text-gray-600">
                              <MapPin className="w-4 h-4 mr-3" />
                              <div>
                                {selectedWorkOrder.customer_site?.address || selectedWorkOrder.customer?.address}
                                {selectedWorkOrder.customer_site?.city && selectedWorkOrder.customer_site?.state && (
                                  <div className="text-gray-500">
                                    {selectedWorkOrder.customer_site.city}, {selectedWorkOrder.customer_site.state}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Schedule</h4>
                        <div className="space-y-2">
                          {selectedWorkOrder.scheduled_date && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Calendar className="w-4 h-4 mr-3" />
                              <div>
                                <div>Scheduled: {new Date(selectedWorkOrder.scheduled_date).toLocaleDateString()}</div>
                                <div className="text-gray-500">
                                  {new Date(selectedWorkOrder.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                          )}
                          {selectedWorkOrder.completed_date && (
                            <div className="flex items-center text-sm text-gray-600">
                              <CheckCircle className="w-4 h-4 mr-3" />
                              Completed: {new Date(selectedWorkOrder.completed_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedWorkOrder.description && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Description</h4>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700">{selectedWorkOrder.description}</p>
                      </div>
                    </div>
                  )}

                  {selectedWorkOrder.notes && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Notes</h4>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700">{selectedWorkOrder.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Time Tracking Tab */}
              {activeTab === 'time' && (
                <div className="space-y-6">
                  {/* Timer Controls */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">Time Tracker</h3>
                        <div className="text-3xl font-mono font-bold text-blue-600 mt-2">
                          {formatTime(elapsedTime)}
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        {!isTimerRunning ? (
                          <button
                            onClick={startTimer}
                            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Start Timer
                          </button>
                        ) : (
                          <button
                            onClick={stopTimer}
                            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            <Square className="w-4 h-4 mr-2" />
                            Stop Timer
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Time Entries List */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Time Entries</h3>
                    {timeEntries.length > 0 ? (
                      <div className="space-y-3">
                        {timeEntries.map((entry) => (
                          <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {formatDuration(entry.duration_minutes)}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {new Date(entry.start_time).toLocaleDateString()} - {entry.description}
                                </div>
                              </div>
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                entry.status === 'approved' ? 'text-green-700 bg-green-100' :
                                entry.status === 'rejected' ? 'text-red-700 bg-red-100' :
                                'text-yellow-700 bg-yellow-100'
                              }`}>
                                {entry.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No time entries recorded yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Photos Tab */}
              {activeTab === 'photos' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Job Photos</h3>
                    <button
                      onClick={() => setShowPhotoModal(true)}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Add Photo
                    </button>
                  </div>

                  {photos.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {photos.map((photo) => (
                        <div key={photo.id} className="relative group">
                          <img
                            src={photo.photo_url}
                            alt={photo.caption || 'Work order photo'}
                            className="w-full h-48 object-cover rounded-lg border border-gray-200"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
                            <button
                              onClick={() => deletePhoto(photo.id)}
                              className="opacity-0 group-hover:opacity-100 text-white bg-red-600 rounded-full p-2 hover:bg-red-700 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {photo.caption && (
                            <div className="mt-2">
                              <p className="text-sm text-gray-600">{photo.caption}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Camera className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Photos</h3>
                      <p className="text-gray-600 mb-4">Add photos to document work progress</p>
                      <button
                        onClick={() => setShowPhotoModal(true)}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Add First Photo
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Purchase Orders Tab */}
              {activeTab === 'purchase-orders' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Purchase Orders for this Job</h3>
                    <button
                      onClick={createPurchaseOrder}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Create Purchase Order
                    </button>
                  </div>

                  {purchaseOrders.length > 0 ? (
                    <div className="space-y-4">
                      {purchaseOrders.map((po) => (
                        <div key={po.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-4">
                                <h4 className="text-lg font-semibold text-gray-900">{po.po_number}</h4>
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPOStatusColor(po.status)}`}>
                                  {po.status}
                                </span>
                              </div>
                              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Vendor:</span>
                                  <p className="text-sm text-gray-900">{po.vendor.name}</p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Amount:</span>
                                  <p className="text-sm text-gray-900">${po.total_amount.toFixed(2)}</p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Order Date:</span>
                                  <p className="text-sm text-gray-900">{new Date(po.order_date).toLocaleDateString()}</p>
                                </div>
                              </div>
                              {po.expected_delivery && (
                                <div className="mt-2">
                                  <span className="text-sm font-medium text-gray-700">Expected Delivery:</span>
                                  <p className="text-sm text-gray-900">{new Date(po.expected_delivery).toLocaleDateString()}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {
                                  // Navigate to purchase orders page and show this PO
                                  localStorage.setItem('selected_purchase_order', po.id)
                                  window.dispatchEvent(new CustomEvent('navigate', { detail: 'purchase-orders' }))
                                }}
                                className="text-blue-600 hover:text-blue-800 p-2 transition-colors"
                                title="View Purchase Order"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Purchase Orders</h3>
                      <p className="text-gray-600 mb-4">No purchase orders have been created for this work order yet.</p>
                      <button
                        onClick={createPurchaseOrder}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Create Purchase Order
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Add Photo</h3>
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Photo Caption (Optional)
                  </label>
                  <input
                    type="text"
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe what this photo shows..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Photo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {uploading && (
                <div className="mt-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-600 mt-2">Uploading photo...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}