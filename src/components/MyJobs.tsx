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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
          <p className="text-gray-600">Manage your assigned work orders</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Jobs</p>
              <p className="text-2xl font-bold text-gray-900">{workOrders.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-gray-900">{workOrders.filter(wo => wo.status === 'in_progress').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <Calendar className="w-8 h-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Scheduled</p>
              <p className="text-2xl font-bold text-gray-900">{workOrders.filter(wo => wo.status === 'scheduled').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Work Orders Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workOrders.map((workOrder) => (
              <div key={workOrder.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{workOrder.wo_number}</h3>
                    <p className="text-sm text-gray-600 mb-2">{workOrder.title}</p>
                    <div className="flex space-x-2 mb-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workOrder.status)}`}>
                        {workOrder.status.replace('_', ' ')}
                      </span>
                      {workOrder.priority && (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          workOrder.priority === 'urgent' ? 'text-red-700 bg-red-100' :
                          workOrder.priority === 'high' ? 'text-orange-700 bg-orange-100' :
                          workOrder.priority === 'medium' ? 'text-yellow-700 bg-yellow-100' :
                          'text-green-700 bg-green-100'
                        }`}>
                          {workOrder.priority}
                        </span>
                      )}
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
                  
                  {workOrder.customer?.email && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="w-4 h-4 mr-3" />
                      <a href={`mailto:${workOrder.customer.email}`} className="text-blue-600 hover:text-blue-800">
                        {workOrder.customer.email}
                      </a>
                    </div>
                  )}
                  
                  {workOrder.customer?.phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="w-4 h-4 mr-3" />
                      <a href={`tel:${workOrder.customer.phone}`} className="text-blue-600 hover:text-blue-800">
                        {workOrder.customer.phone}
                      </a>
                    </div>
                  )}
                  
                  {workOrder.scheduled_date && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-3" />
                      <span>{new Date(workOrder.scheduled_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  
                  {(workOrder.customer?.address || workOrder.customer_site?.address) && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-3" />
                      <span>{workOrder.customer_site?.address || workOrder.customer?.address}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  <div className="flex space-x-2">
                    {workOrder.status === 'scheduled' && (
                      <button
                        onClick={() => updateWorkOrderStatus('in_progress')}
                        className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Start
                      </button>
                    )}
                    {workOrder.status === 'in_progress' && (
                      <button
                        onClick={() => updateWorkOrderStatus('completed')}
                        className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Complete
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedWorkOrder(workOrder)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
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