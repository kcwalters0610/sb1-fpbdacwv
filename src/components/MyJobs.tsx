import React, { useState, useEffect } from 'react'
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Camera, 
  Upload, 
  X, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Timer,
  Play,
  Pause,
  Square,
  ShoppingCart,
  Eye,
  Edit,
  Trash2
} from 'lucide-react'
import { supabase, WorkOrder, Profile } from '../lib/supabase'

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

export default function MyJobs() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null)
  const [activeTab, setActiveTab] = useState('details')
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [photos, setPhotos] = useState<WorkOrderPhoto[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [uploading, setUploading] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<WorkOrderPhoto | null>(null)
  const [photoCaption, setPhotoCaption] = useState('')
  
  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [currentTimeEntry, setCurrentTimeEntry] = useState<any>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    getCurrentUser()
    loadMyWorkOrders()
  }, [])

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
        
        setCurrentUser(profile)
      }
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const loadMyWorkOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          customer:customers(*),
          assigned_technician:profiles!work_orders_assigned_to_fkey(*),
          customer_site:customer_sites(*)
        `)
        .eq('assigned_to', user.id)
        .in('status', ['open', 'scheduled', 'in_progress'])
        .order('scheduled_date', { ascending: true })

      if (error) throw error
      setWorkOrders(data || [])
      
      // Auto-select first work order if none selected
      if (data && data.length > 0 && !selectedWorkOrder) {
        setSelectedWorkOrder(data[0])
      }
    } catch (error) {
      console.error('Error loading work orders:', error)
    } finally {
      setLoading(false)
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

  const updateWorkOrderStatus = async (status: string) => {
    if (!selectedWorkOrder) return

    try {
      const updateData: any = { status }
      if (status === 'completed') {
        updateData.completed_date = new Date().toISOString()
      }

      const { error } = await supabase
        .from('work_orders')
        .update(updateData)
        .eq('id', selectedWorkOrder.id)

      if (error) throw error

      // Update local state
      setSelectedWorkOrder({ ...selectedWorkOrder, status })
      loadMyWorkOrders()
    } catch (error) {
      console.error('Error updating work order status:', error)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (workOrders.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Jobs</h3>
        <p className="text-gray-600">You don't have any active work orders assigned to you.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
        <p className="text-gray-600">Manage your assigned work orders</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Work Orders List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Active Jobs ({workOrders.length})</h3>
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {workOrders.map((workOrder) => (
                <div
                  key={workOrder.id}
                  onClick={() => setSelectedWorkOrder(workOrder)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedWorkOrder?.id === workOrder.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{workOrder.wo_number}</h4>
                      <p className="text-sm text-gray-600 mt-1">{workOrder.title}</p>
                      <div className="flex items-center mt-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workOrder.status)}`}>
                          {workOrder.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="w-4 h-4 mr-2" />
                      {workOrder.customer?.customer_type === 'residential' 
                        ? `${workOrder.customer?.first_name} ${workOrder.customer?.last_name}`
                        : workOrder.customer?.company_name
                      }
                    </div>
                    
                    {workOrder.scheduled_date && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-2" />
                        {new Date(workOrder.scheduled_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Work Order Details */}
        <div className="lg:col-span-2">
          {selectedWorkOrder ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
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
                        <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                          selectedWorkOrder.priority === 'urgent' ? 'text-red-700 bg-red-100' :
                          selectedWorkOrder.priority === 'high' ? 'text-orange-700 bg-orange-100' :
                          selectedWorkOrder.priority === 'medium' ? 'text-yellow-700 bg-yellow-100' :
                          'text-green-700 bg-green-100'
                        }`}>
                          {selectedWorkOrder.priority} priority
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Status Update Buttons */}
                  <div className="flex space-x-2">
                    {selectedWorkOrder.status === 'scheduled' && (
                      <button
                        onClick={() => updateWorkOrderStatus('in_progress')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Start Job
                      </button>
                    )}
                    {selectedWorkOrder.status === 'in_progress' && (
                      <button
                        onClick={() => updateWorkOrderStatus('completed')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Complete Job
                      </button>
                    )}
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
                        <p className="text-gray-600 mb-4">Add photos to document your work progress</p>
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
                        <p className="text-gray-600 mb-4">Create a purchase order to order parts and materials needed for this job.</p>
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
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Job</h3>
              <p className="text-gray-600">Choose a work order from the list to view details</p>
            </div>
          )}
        </div>
      </div>

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