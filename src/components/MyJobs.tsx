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
  Trash2,
  Search
} from 'lucide-react'
import { supabase, WorkOrder, Profile } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'

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
  const { viewType, setViewType } = useViewPreference('myJobs')
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [showResolutionForm, setShowResolutionForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [photos, setPhotos] = useState<WorkOrderPhoto[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [uploading, setUploading] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<WorkOrderPhoto | null>(null)
  const [photoCaption, setPhotoCaption] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [currentTimeEntry, setCurrentTimeEntry] = useState<any>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    getCurrentUser()
    loadMyWorkOrders()
  }, [])

  useEffect(() => {
    if (selectedWorkOrder && showDetailModal) {
      loadTimeEntries()
      loadPhotos()
      loadPurchaseOrders()
    }
  }, [selectedWorkOrder, showDetailModal])

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

  const openDetailModal = (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder)
    setShowDetailModal(true)
    setActiveTab('details')
  }

  const closeDetailModal = () => {
    setShowDetailModal(false)
    setSelectedWorkOrder(null)
    setActiveTab('details')
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

  const filteredWorkOrders = workOrders.filter(workOrder =>
    workOrder.wo_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    workOrder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (workOrder.customer?.customer_type === 'residential' 
      ? `${workOrder.customer?.first_name} ${workOrder.customer?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
      : workOrder.customer?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

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

      {/* Search and View Toggle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search my jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <ViewToggle viewType={viewType} onViewChange={setViewType} />
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
                  <tr key={workOrder.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{workOrder.wo_number}</div>
                      <div className="text-sm text-gray-500">{workOrder.title}</div>
                      {workOrder.priority && (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 ${getPriorityColor(workOrder.priority)}`}>
                          {workOrder.priority}
                        </span>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {workOrder.customer?.customer_type === 'residential' 
                          ? `${workOrder.customer?.first_name} ${workOrder.customer?.last_name}`
                          : workOrder.customer?.company_name
                        }
                      </div>
                      {workOrder.customer?.phone && (
                        <div className="text-sm text-gray-500">{workOrder.customer.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workOrder.status)}`}>
                        {workOrder.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {workOrder.scheduled_date ? new Date(workOrder.scheduled_date).toLocaleDateString() : 'Not scheduled'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openDetailModal(workOrder)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {workOrder.status === 'scheduled' && (
                          <button
                            onClick={() => {
                              setSelectedWorkOrder(workOrder)
                              updateWorkOrderStatus('in_progress')
                            }}
                            className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-xs"
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Start
                          </button>
                        )}
                        {workOrder.status === 'in_progress' && (
                          <button
                            onClick={() => {
                              setSelectedWorkOrder(workOrder)
                              updateWorkOrderStatus('completed')
                            }}
                            className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-xs"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Complete
                          </button>
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
                      <div className="flex space-x-2 mb-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workOrder.status)}`}>
                          {workOrder.status.replace('_', ' ')}
                        </span>
                        {workOrder.priority && (
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(workOrder.priority)}`}>
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
                          onClick={() => {
                            setSelectedWorkOrder(workOrder)
                            updateWorkOrderStatus('in_progress')
                          }}
                          className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Start
                        </button>
                      )}
                      {workOrder.status === 'in_progress' && (
                        <button
                          onClick={() => {
                            setSelectedWorkOrder(workOrder)
                            updateWorkOrderStatus('completed')
                          }}
                          className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Complete
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => openDetailModal(workOrder)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedWorkOrder.wo_number} - {selectedWorkOrder.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedWorkOrder.customer?.customer_type === 'residential' 
                      ? `${selectedWorkOrder.customer?.first_name} ${selectedWorkOrder.customer?.last_name}`
                      : selectedWorkOrder.customer?.company_name
                    }
                  </p>
                </div>
                <button
                  onClick={closeDetailModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="mt-6">
                <nav className="flex space-x-8">
                  {[
                    { id: 'details', name: 'Job Details', icon: FileText },
                    { id: 'time', name: 'Time Tracking', icon: Clock },
                    { id: 'photos', name: 'Photos', icon: Camera },
                    { id: 'purchase-orders', name: 'Purchase Orders', icon: ShoppingCart }
                  ].map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center space-x-2 py-2 border-b-2 font-medium text-sm ${
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
                  <button
                    onClick={() => setActiveTab('resolution')}
                    className={`flex items-center space-x-2 py-2 border-b-2 font-medium text-sm ${
                      activeTab === 'resolution'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Resolution</span>
                  </button>
                </nav>
              </div>
            </div>

            <div className="p-6">
              {/* Job Details Tab */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-4">Work Order Information</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Status:</span>
                          <div className="flex space-x-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedWorkOrder.status)}`}>
                              {selectedWorkOrder.status.replace('_', ' ')}
                            </span>
                            {selectedWorkOrder.status === 'scheduled' && (
                              <button
                                onClick={() => updateWorkOrderStatus('in_progress')}
                                className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-xs"
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Start
                              </button>
                            )}
                            {selectedWorkOrder.status === 'in_progress' && (
                              <button
                                onClick={() => updateWorkOrderStatus('completed')}
                                className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-xs"
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Complete
                              </button>
                            )}
                          </div>
                        </div>
                        {selectedWorkOrder.priority && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Priority:</span>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedWorkOrder.priority)}`}>
                              {selectedWorkOrder.priority}
                            </span>
                          </div>
                        )}
                        {selectedWorkOrder.scheduled_date && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Scheduled:</span>
                            <span className="text-sm text-gray-900">
                              {new Date(selectedWorkOrder.scheduled_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {selectedWorkOrder.completed_date && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Completed:</span>
                            <span className="text-sm text-gray-900">
                              {new Date(selectedWorkOrder.completed_date).toLocaleDateString()}
                            </span>
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
                        {selectedWorkOrder.customer?.email && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Email:</span>
                            <a href={`mailto:${selectedWorkOrder.customer.email}`} className="text-sm text-blue-600 hover:text-blue-800">
                              {selectedWorkOrder.customer.email}
                            </a>
                          </div>
                        )}
                        {selectedWorkOrder.customer?.phone && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Phone:</span>
                            <a href={`tel:${selectedWorkOrder.customer.phone}`} className="text-sm text-blue-600 hover:text-blue-800">
                              {selectedWorkOrder.customer.phone}
                            </a>
                          </div>
                        )}
                        {(selectedWorkOrder.customer?.address || selectedWorkOrder.customer_site?.address) && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Address:</span>
                            <span className="text-sm text-gray-900">
                              {selectedWorkOrder.customer_site?.address || selectedWorkOrder.customer?.address}
                            </span>
                          </div>
                        )}
                      </div>
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
                </div>
              )}

              {/* Time Tracking Tab */}
              {activeTab === 'time' && (
                <div className="space-y-6">
                  {/* Timer Section */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">Time Tracker</h4>
                        <p className="text-sm text-gray-600">Track time spent on this job</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        {isTimerRunning && (
                          <div className="text-2xl font-mono font-bold text-blue-600">
                            {formatTime(elapsedTime)}
                          </div>
                        )}
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

                  {/* Time Entries */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Time Entries</h4>
                    {timeEntries.length > 0 ? (
                      <div className="space-y-3">
                        {timeEntries.map((entry) => (
                          <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {formatDuration(entry.duration_minutes)}
                                </p>
                                <p className="text-sm text-gray-600">{entry.description}</p>
                                <p className="text-xs text-gray-500">
                                  {new Date(entry.start_time).toLocaleDateString()} - 
                                  {new Date(entry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {entry.end_time && ` to ${new Date(entry.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                </p>
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
                        <Timer className="w-12 h-12 mx-auto mb-4 text-gray-300" />
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
                    <h4 className="text-lg font-medium text-gray-900">Job Photos</h4>
                    <button
                      onClick={() => setShowPhotoModal(true)}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Add Photo
                    </button>
                  </div>

                  {photos.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {photos.map((photo) => (
                        <div key={photo.id} className="border border-gray-200 rounded-lg overflow-hidden">
                          <img
                            src={photo.photo_url}
                            alt={photo.caption || 'Work order photo'}
                            className="w-full h-48 object-cover"
                          />
                          <div className="p-4">
                            {photo.caption && (
                              <p className="text-sm text-gray-700 mb-2">{photo.caption}</p>
                            )}
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-500">
                                {new Date(photo.created_at).toLocaleDateString()}
                              </p>
                              <button
                                onClick={() => deletePhoto(photo.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Camera className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No photos uploaded yet</p>
                      <button
                        onClick={() => setShowPhotoModal(true)}
                        className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                    <h4 className="text-lg font-medium text-gray-900">Purchase Orders for this Job</h4>
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
                        <div key={po.id} className="border border-gray-200 rounded-lg p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h5 className="text-lg font-semibold text-gray-900">{po.po_number}</h5>
                              <p className="text-sm text-gray-600">Vendor: {po.vendor.name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-green-600">${po.total_amount.toFixed(2)}</p>
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPOStatusColor(po.status)}`}>
                                {po.status}
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Order Date:</span>
                              <span className="ml-2 text-gray-900">{new Date(po.order_date).toLocaleDateString()}</span>
                            </div>
                            {po.expected_delivery && (
                              <div>
                                <span className="font-medium text-gray-700">Expected Delivery:</span>
                                <span className="ml-2 text-gray-900">{new Date(po.expected_delivery).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No purchase orders have been created for this work order yet.</p>
                      <p className="text-sm mt-2">Create a purchase order to order parts and materials needed for this job.</p>
                      <button
                        onClick={createPurchaseOrder}
                        className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Create Purchase Order
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Resolution Tab */}
              {activeTab === 'resolution' && (
                <div className="space-y-6">
                  {selectedWorkOrder.status === 'completed' ? (
                    <>
                      {/* Completion Status */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                        <div className="flex items-center mb-4">
                          <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
                          <h3 className="text-lg font-semibold text-green-900">Work Order Completed</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-green-700">Completed Date</p>
                            <p className="text-green-900">
                              {selectedWorkOrder.completed_date 
                                ? new Date(selectedWorkOrder.completed_date).toLocaleDateString()
                                : 'Not recorded'
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-green-700">Assigned Technician</p>
                            <p className="text-green-900">
                              {selectedWorkOrder.assigned_technician 
                                ? `${selectedWorkOrder.assigned_technician.first_name} ${selectedWorkOrder.assigned_technician.last_name}`
                                : 'Not assigned'
                              }
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Resolution Details */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Resolution Details</h4>
                        
                        {selectedWorkOrder.notes ? (
                          <div className="mb-6">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Resolution Notes</h5>
                            <div className="bg-gray-50 rounded-lg p-4">
                              <p className="text-gray-900">{selectedWorkOrder.notes}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-yellow-800">No resolution notes were recorded for this work order.</p>
                          </div>
                        )}

                        {selectedWorkOrder.actual_hours && selectedWorkOrder.actual_hours > 0 && (
                          <div className="mb-6">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Total Hours Worked</h5>
                            <p className="text-2xl font-bold text-blue-600">{selectedWorkOrder.actual_hours} hours</p>
                          </div>
                        )}
                      </div>

                      {/* Work Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <Clock className="w-6 h-6 text-blue-600 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-blue-700">Time Logged</p>
                              <p className="text-lg font-bold text-blue-900">
                                {timeEntries.length} {timeEntries.length === 1 ? 'entry' : 'entries'}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <Camera className="w-6 h-6 text-purple-600 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-purple-700">Photos Taken</p>
                              <p className="text-lg font-bold text-purple-900">
                                {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <ShoppingCart className="w-6 h-6 text-green-600 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-green-700">Purchase Orders</p>
                              <p className="text-lg font-bold text-green-900">
                                {purchaseOrders.length} {purchaseOrders.length === 1 ? 'order' : 'orders'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Recent Activity */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h4>
                        
                        {/* Recent Time Entries */}
                        {timeEntries.length > 0 && (
                          <div className="mb-6">
                            <h5 className="text-sm font-medium text-gray-700 mb-3">Latest Time Entries</h5>
                            <div className="space-y-2">
                              {timeEntries.slice(0, 3).map((entry) => (
                                <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(entry.start_time).toLocaleDateString()} - {Math.round(entry.duration_minutes / 60 * 10) / 10}h
                                    </p>
                                  </div>
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    entry.status === 'approved' ? 'bg-green-100 text-green-800' :
                                    entry.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {entry.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recent Photos */}
                        {photos.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-3">Recent Photos</h5>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {photos.slice(0, 4).map((photo) => (
                                <div key={photo.id} className="relative">
                                  <img
                                    src={photo.photo_url}
                                    alt={photo.caption || 'Work order photo'}
                                    className="w-full h-20 object-cover rounded-lg border border-gray-200"
                                  />
                                  {photo.caption && (
                                    <p className="text-xs text-gray-600 mt-1 truncate">{photo.caption}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Work Order Not Completed */
                    <div className="space-y-6">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                        <div className="flex items-center mb-4">
                          <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
                          <h3 className="text-lg font-semibold text-yellow-900">Work Order In Progress</h3>
                        </div>
                        <p className="text-yellow-800 mb-4">
                          This work order is currently {selectedWorkOrder.status.replace('_', ' ')} and has not been completed yet.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-yellow-700">Current Status</p>
                            <p className="text-yellow-900 capitalize">{selectedWorkOrder.status.replace('_', ' ')}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-yellow-700">Assigned To</p>
                            <p className="text-yellow-900">
                              {selectedWorkOrder.assigned_technician 
                                ? `${selectedWorkOrder.assigned_technician.first_name} ${selectedWorkOrder.assigned_technician.last_name}`
                                : 'Not assigned'
                              }
                            </p>
                          </div>
                          {selectedWorkOrder.scheduled_date && (
                            <div>
                              <p className="text-sm font-medium text-yellow-700">Scheduled Date</p>
                              <p className="text-yellow-900">
                                {new Date(selectedWorkOrder.scheduled_date).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {selectedWorkOrder.status === 'in_progress' && (
                          <div className="mt-4">
                            <button
                              onClick={() => updateWorkOrderStatus('completed')}
                              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Mark as Completed
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Current Progress */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <Clock className="w-6 h-6 text-blue-600 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-blue-700">Time Logged</p>
                              <p className="text-lg font-bold text-blue-900">
                                {timeEntries.length} {timeEntries.length === 1 ? 'entry' : 'entries'}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <Camera className="w-6 h-6 text-purple-600 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-purple-700">Photos Taken</p>
                              <p className="text-lg font-bold text-purple-900">
                                {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <ShoppingCart className="w-6 h-6 text-green-600 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-green-700">Purchase Orders</p>
                              <p className="text-lg font-bold text-green-900">
                                {purchaseOrders.length} {purchaseOrders.length === 1 ? 'order' : 'orders'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
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

      {/* Resolution Form Modal */}
      {showResolutionForm && selectedWorkOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Complete Work Order: {selectedWorkOrder.wo_number}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Please describe what work was completed
              </p>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <h4 className="text-md font-medium text-gray-900 mb-2">Work Order Details</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700"><strong>Title:</strong> {selectedWorkOrder.title}</p>
                  {selectedWorkOrder.description && (
                    <p className="text-sm text-gray-700 mt-1"><strong>Description:</strong> {selectedWorkOrder.description}</p>
                  )}
                  <p className="text-sm text-gray-700 mt-1">
                    <strong>Customer:</strong> {selectedWorkOrder.customer?.customer_type === 'residential' 
                      ? `${selectedWorkOrder.customer?.first_name} ${selectedWorkOrder.customer?.last_name}`
                      : selectedWorkOrder.customer?.company_name
                    }
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resolution Notes *
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe what work was completed, any issues found, parts used, recommendations for the customer, etc..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This information will be visible to managers and can be included in customer communications.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowResolutionForm(false)
                    setResolutionNotes('')
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitCompletion}
                  disabled={!resolutionNotes.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Complete Work Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}