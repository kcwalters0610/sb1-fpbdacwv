import React, { useState, useEffect } from 'react'
import { 
  Calendar, 
  MapPin, 
  User, 
  Clock, 
  Phone, 
  AlertTriangle, 
  CheckCircle, 
  Truck, 
  Filter, 
  Navigation, 
  Camera,
  Upload,
  X,
  Plus,
  Minus,
  Save,
  Edit,
  Trash2
} from 'lucide-react'
import { supabase, WorkOrder, Profile } from '../lib/supabase'

interface MyJobsWorkOrder extends WorkOrder {
  assigned_technician?: Profile
  assignments?: any[]
}

interface TimeEntry {
  id: string
  work_order_id: string
  start_time: string
  end_time?: string
  duration_minutes: number
  description: string
  status: 'pending' | 'approved' | 'rejected'
}

interface WorkOrderPhoto {
  id: string
  work_order_id: string
  photo_url: string
  caption?: string
  uploaded_by: string
  created_at: string
}

export default function MyJobs() {
  const [workOrders, setWorkOrders] = useState<MyJobsWorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<MyJobsWorkOrder | null>(null)
  const [statusFilter, setStatusFilter] = useState('active')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [photos, setPhotos] = useState<WorkOrderPhoto[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [timeForm, setTimeForm] = useState({
    start_time: '',
    end_time: '',
    duration_minutes: 0,
    description: ''
  })

  const [photoForm, setPhotoForm] = useState({
    caption: ''
  })

  useEffect(() => {
    getCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadMyJobs()
    }
  }, [currentUser, statusFilter])

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

  const loadMyJobs = async () => {
    try {
      if (!currentUser?.profile) return

      // First, get work orders directly assigned to the user
      const { data: directlyAssigned, error: directError } = await supabase
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
        .eq('assigned_to', currentUser.profile.id)
        .order('scheduled_date', { ascending: true })

      if (directError) {
        console.error('Error loading directly assigned work orders:', directError)
        return
      }

      // Second, get work order IDs where the user is assigned through work_order_assignments
      const { data: assignments, error: assignmentError } = await supabase
        .from('work_order_assignments')
        .select('work_order_id')
        .eq('tech_id', currentUser.profile.id)

      if (assignmentError) {
        console.error('Error loading work order assignments:', assignmentError)
        return
      }

      let teamAssigned: any[] = []
      if (assignments && assignments.length > 0) {
        const workOrderIds = assignments.map(a => a.work_order_id)
        
        const { data: teamWorkOrders, error: teamError } = await supabase
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
          .in('id', workOrderIds)
          .order('scheduled_date', { ascending: true })

        if (teamError) {
          console.error('Error loading team assigned work orders:', teamError)
          return
        }

        teamAssigned = teamWorkOrders || []
      }

      // Combine and deduplicate results
      const allWorkOrders = [...(directlyAssigned || []), ...teamAssigned]
      const uniqueWorkOrders = allWorkOrders.filter((order, index, self) => 
        index === self.findIndex(o => o.id === order.id)
      )

      // Filter based on status
      let filteredOrders = uniqueWorkOrders
      
      if (statusFilter === 'active') {
        filteredOrders = filteredOrders.filter(order => 
          ['open', 'scheduled', 'in_progress'].includes(order.status)
        )
      } else if (statusFilter === 'completed') {
        filteredOrders = filteredOrders.filter(order => 
          order.status === 'completed'
        )
      }

      setWorkOrders(filteredOrders)
    } catch (error) {
      console.error('Error loading my jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (workOrderId: string, status: string) => {
    try {
      const updateData: any = { status }
      if (status === 'completed') {
        updateData.completed_date = new Date().toISOString()
      }

      const { error } = await supabase
        .from('work_orders')
        .update(updateData)
        .eq('id', workOrderId)

      if (error) throw error
      loadMyJobs()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const loadTimeEntries = async (workOrderId: string) => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('work_order_id', workOrderId)
        .eq('user_id', currentUser.profile.id)
        .order('start_time', { ascending: false })

      if (error) throw error
      setTimeEntries(data || [])
    } catch (error) {
      console.error('Error loading time entries:', error)
    }
  }

  const loadPhotos = async (workOrderId: string) => {
    try {
      const { data, error } = await supabase
        .from('work_order_photos')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPhotos(data || [])
    } catch (error) {
      console.error('Error loading photos:', error)
    }
  }

  const handleTimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile) throw new Error('Profile not found')

      const entryData = {
        user_id: user.id,
        company_id: profile.company_id,
        work_order_id: selectedOrder.id,
        start_time: timeForm.start_time,
        end_time: timeForm.end_time || null,
        duration_minutes: timeForm.duration_minutes,
        description: timeForm.description,
        entry_type: 'work',
        status: 'pending'
      }

      const { error } = await supabase
        .from('time_entries')
        .insert([entryData])

      if (error) throw error

      setShowTimeModal(false)
      resetTimeForm()
      loadTimeEntries(selectedOrder.id)
    } catch (error) {
      console.error('Error saving time entry:', error)
      alert('Error saving time entry. Please try again.')
    }
  }

  const resetTimeForm = () => {
    setTimeForm({
      start_time: '',
      end_time: '',
      duration_minutes: 0,
      description: ''
    })
  }

  const calculateDuration = () => {
    if (timeForm.start_time && timeForm.end_time) {
      const start = new Date(timeForm.start_time)
      const end = new Date(timeForm.end_time)
      const diffMs = end.getTime() - start.getTime()
      const diffMins = Math.round(diffMs / (1000 * 60))
      setTimeForm({ ...timeForm, duration_minutes: diffMins })
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedOrder) return

    setUploadingPhoto(true)

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${selectedOrder.id}/${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
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
          work_order_id: selectedOrder.id,
          company_id: currentUser.profile.company_id,
          photo_url: publicUrl,
          caption: photoForm.caption || null,
          uploaded_by: currentUser.profile.id
        }])

      if (insertError) throw insertError

      setPhotoForm({ caption: '' })
      loadPhotos(selectedOrder.id)
    } catch (error) {
      console.error('Error uploading photo:', error)
      alert('Error uploading photo. Please try again.')
    } finally {
      setUploadingPhoto(false)
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
      
      if (selectedOrder) {
        loadPhotos(selectedOrder.id)
      }
    } catch (error) {
      console.error('Error deleting photo:', error)
    }
  }

  const openJobDetails = (order: MyJobsWorkOrder) => {
    setSelectedOrder(order)
    loadTimeEntries(order.id)
    loadPhotos(order.id)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-gray-100 text-gray-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'scheduled': return 'bg-purple-100 text-purple-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
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
          <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
          <p className="text-gray-600">Work orders assigned to you or your team</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="active">Active Jobs</option>
            <option value="completed">Completed Jobs</option>
            <option value="all">All Jobs</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <Calendar className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Jobs</p>
              <p className="text-2xl font-bold text-gray-900">{workOrders.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-gray-900">
                {workOrders.filter(o => o.status === 'in_progress').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">
                {workOrders.filter(o => o.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Urgent</p>
              <p className="text-2xl font-bold text-gray-900">
                {workOrders.filter(o => o.priority === 'urgent').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Work Orders List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {workOrders.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {workOrders.map((order) => (
              <div 
                key={order.id} 
                className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => openJobDetails(order)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{order.wo_number}</h3>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(order.priority)}`}>
                        {order.priority} priority
                      </span>
                    </div>
                    
                    <p className="text-gray-600 mb-3">{order.title}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center text-gray-600">
                        <User className="w-4 h-4 mr-2" />
                        <span>
                          {order.customer?.customer_type === 'residential' 
                            ? `${order.customer?.first_name} ${order.customer?.last_name}`
                            : order.customer?.company_name
                          }
                        </span>
                      </div>
                      
                      {order.scheduled_date && (
                        <div className="flex items-center text-gray-600">
                          <Calendar className="w-4 h-4 mr-2" />
                          <span>{new Date(order.scheduled_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      
                      {(order.customer?.address || order.customer_site?.address) && (
                        <div className="flex items-center text-gray-600">
                          <MapPin className="w-4 h-4 mr-2" />
                          <span>{order.customer_site?.address || order.customer?.address}</span>
                        </div>
                      )}
                    </div>

                    {/* Show assignment info */}
                    <div className="mt-3 flex items-center space-x-4 text-sm">
                      {order.assigned_to === currentUser.profile.id && (
                        <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-md">
                          <User className="w-3 h-3 mr-1" />
                          Directly assigned
                        </span>
                      )}
                      {order.assignments && order.assignments.some(a => a.tech_id === currentUser.profile.id) && (
                        <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-md">
                          <Truck className="w-3 h-3 mr-1" />
                          Team assignment
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    {order.status !== 'completed' && (
                      <select
                        value={order.status}
                        onChange={(e) => {
                          e.stopPropagation()
                          updateStatus(order.id, e.target.value)
                        }}
                        className={`text-xs font-medium rounded px-2 py-1 border-0 ${getStatusColor(order.status)}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="open">Open</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
            <p className="text-gray-600">
              {statusFilter === 'active' 
                ? 'You have no active work orders assigned to you or your team.'
                : statusFilter === 'completed'
                ? 'You have no completed work orders.'
                : 'You have no work orders assigned to you or your team.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Job Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedOrder.wo_number} - {selectedOrder.title}
                  </h3>
                  <div className="flex items-center space-x-3 mt-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedOrder.status)}`}>
                      {selectedOrder.status.replace('_', ' ')}
                    </span>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(selectedOrder.priority)}`}>
                      {selectedOrder.priority} priority
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Job Information */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Job Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Customer:</span>
                      <span className="text-sm text-gray-900">
                        {selectedOrder.customer?.customer_type === 'residential' 
                          ? `${selectedOrder.customer?.first_name} ${selectedOrder.customer?.last_name}`
                          : selectedOrder.customer?.company_name
                        }
                      </span>
                    </div>
                    {selectedOrder.customer_site && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Site:</span>
                        <span className="text-sm text-gray-900">{selectedOrder.customer_site.site_name}</span>
                      </div>
                    )}
                    {selectedOrder.scheduled_date && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Scheduled:</span>
                        <span className="text-sm text-gray-900">
                          {new Date(selectedOrder.scheduled_date).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedOrder.project && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Project:</span>
                        <span className="text-sm text-gray-900">{selectedOrder.project.project_name}</span>
                      </div>
                    )}
                  </div>

                  {selectedOrder.description && (
                    <div className="mt-6">
                      <h5 className="text-md font-medium text-gray-900 mb-3">Description</h5>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700">{selectedOrder.description}</p>
                      </div>
                    </div>
                  )}

                  {/* Assignment Information */}
                  <div className="mt-6">
                    <h5 className="text-md font-medium text-gray-900 mb-3">Assignment</h5>
                    <div className="space-y-2">
                      {selectedOrder.assigned_to === currentUser.profile.id && (
                        <div className="flex items-center text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">
                          <User className="w-4 h-4 mr-2" />
                          <span>Directly assigned to you</span>
                        </div>
                      )}
                      {selectedOrder.assignments && selectedOrder.assignments.some(a => a.tech_id === currentUser.profile.id) && (
                        <div className="flex items-center text-sm text-purple-700 bg-purple-50 px-3 py-2 rounded-lg">
                          <Truck className="w-4 h-4 mr-2" />
                          <span>Assigned to your team</span>
                        </div>
                      )}
                      {selectedOrder.assignments && selectedOrder.assignments.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">All assigned technicians:</p>
                          <div className="space-y-1">
                            {selectedOrder.assignments.map((assignment) => (
                              <div key={assignment.id} className="flex items-center text-sm text-gray-600">
                                <User className="w-3 h-3 mr-2" />
                                <span>
                                  {assignment.tech.first_name} {assignment.tech.last_name}
                                  {assignment.is_primary && <span className="text-blue-600 ml-1">(Primary)</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Customer Contact */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Customer Contact</h4>
                  <div className="space-y-3">
                    {selectedOrder.customer?.email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium mr-2">Email:</span>
                        <a href={`mailto:${selectedOrder.customer.email}`} className="text-blue-600 hover:text-blue-800">
                          {selectedOrder.customer.email}
                        </a>
                      </div>
                    )}
                    {selectedOrder.customer?.phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium mr-2">Phone:</span>
                        <a href={`tel:${selectedOrder.customer.phone}`} className="text-blue-600 hover:text-blue-800">
                          {selectedOrder.customer.phone}
                        </a>
                      </div>
                    )}
                    {(selectedOrder.customer?.address || selectedOrder.customer_site?.address) && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium mr-2">Address:</span>
                        <span>{selectedOrder.customer_site?.address || selectedOrder.customer?.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 space-y-3">
                    <button
                      onClick={() => setShowTimeModal(true)}
                      className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Clock className="w-5 h-5 mr-2" />
                      Log Time
                    </button>
                    <button
                      onClick={() => setShowPhotoModal(true)}
                      className="w-full inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Add Photos
                    </button>
                  </div>
                </div>
              </div>

              {/* Time Entries */}
              <div className="mt-8">
                <h5 className="text-md font-medium text-gray-900 mb-4">Time Entries</h5>
                {timeEntries.length > 0 ? (
                  <div className="space-y-3">
                    {timeEntries.map((entry) => (
                      <div key={entry.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {formatDuration(entry.duration_minutes)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(entry.start_time).toLocaleString()} - 
                              {entry.end_time && new Date(entry.end_time).toLocaleString()}
                            </p>
                          </div>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            entry.status === 'approved' ? 'bg-green-100 text-green-800' :
                            entry.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {entry.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">{entry.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No time entries logged yet</p>
                )}
              </div>

              {/* Photos */}
              <div className="mt-8">
                <h5 className="text-md font-medium text-gray-900 mb-4">Photos</h5>
                {photos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photo.photo_url}
                          alt={photo.caption || 'Work order photo'}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
                          <button
                            onClick={() => deletePhoto(photo.id)}
                            className="opacity-0 group-hover:opacity-100 text-white hover:text-red-300 transition-opacity"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        {photo.caption && (
                          <p className="text-xs text-gray-600 mt-1">{photo.caption}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No photos uploaded yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Entry Modal */}
      {showTimeModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Log Time Entry</h3>
            </div>
            
            <form onSubmit={handleTimeSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time *
                </label>
                <input
                  type="datetime-local"
                  value={timeForm.start_time}
                  onChange={(e) => setTimeForm({ ...timeForm, start_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={timeForm.end_time}
                  onChange={(e) => setTimeForm({ ...timeForm, end_time: e.target.value })}
                  onBlur={calculateDuration}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  value={timeForm.duration_minutes}
                  onChange={(e) => setTimeForm({ ...timeForm, duration_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={timeForm.description}
                  onChange={(e) => setTimeForm({ ...timeForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  required
                  placeholder="Describe the work performed..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTimeModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Log Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add Photo</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Caption (Optional)
                </label>
                <input
                  type="text"
                  value={photoForm.caption}
                  onChange={(e) => setPhotoForm({ ...photoForm, caption: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe the photo..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Photo *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={uploadingPhoto}
                />
                {uploadingPhoto && (
                  <p className="text-sm text-blue-600 mt-2">Uploading photo...</p>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}