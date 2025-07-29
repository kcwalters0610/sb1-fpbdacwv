import React, { useState, useEffect } from 'react'
import { 
  Grid,
  List,
  Calendar, 
  MapPin, 
  User, 
  Clock, 
  Camera, 
  FileText, 
  CheckCircle, 
  Play, 
  Pause, 
  Square,
  Upload,
  X,
  ExternalLink,
  Sparkles,
  Zap,
  Navigation,
  Package,
  DollarSign,
  Plus,
  Minus,
  ShoppingCart
} from 'lucide-react'
import { supabase, WorkOrder } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'

interface TimeEntry {
  id: string
  start_time: string
  end_time?: string
  duration_minutes?: number
  is_active: boolean
}

export default function MyJobs() {
  const { viewType, setViewType } = useViewPreference('myjobs')
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<WorkOrder | null>(null)
  const [activeTab, setActiveTab] = useState('details')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null)
  const [timerDisplay, setTimerDisplay] = useState('00:00:00')
  const [jobFilter, setJobFilter] = useState('all')

  // Job completion form data
  const [jobStatus, setJobStatus] = useState('')
  const [hoursWorked, setHoursWorked] = useState('')
  const [workNotes, setWorkNotes] = useState('')
  const [resolutionSummary, setResolutionSummary] = useState('')

  // Photo upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [photoCaption, setPhotoCaption] = useState('')
  const [photos, setPhotos] = useState<any[]>([])

  // Parts/Materials used
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [partsUsed, setPartsUsed] = useState<{[key: string]: number}>({})
  const [showPartsModal, setShowPartsModal] = useState(false)
  // GPS tracking state
  const [isTracking, setIsTracking] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceFormData, setInvoiceFormData] = useState({
    description: '',
    labor_hours: '',
    labor_rate: '75',
    service_charge: '',
    tax_rate: '',
    include_parts: true,
    notes: ''
  })
  const [locationTrackerId, setLocationTrackerId] = useState<number | null>(null)

  useEffect(() => {
    getCurrentUser()
    loadMyJobs()
  }, [])

  useEffect(() => {
    loadInventoryItems()
  }, [])


  // Clean up location tracker on component unmount
  useEffect(() => {
    return () => {
      if (locationTrackerId) {
        clearInterval(locationTrackerId);
        setIsTracking(false);
      }
    };
  }, [locationTrackerId]);

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (activeTimer) {
      interval = setInterval(() => {
        const startTime = new Date(activeTimer.start_time)
        const now = new Date()
        const diff = now.getTime() - startTime.getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        setTimerDisplay(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [activeTimer])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setCurrentUser({ ...user, profile })
    }
  }

  const loadMyJobs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          customer:customers(*),
          project:projects(*)
        `)
        .eq('assigned_to', user.id)
        .order('scheduled_date', { ascending: true })

      if (error) throw error
      setWorkOrders(data || [])
    } catch (error) {
      console.error('Error loading my jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .gt('quantity', 0)
        .order('name')

      if (error) throw error
      console.log('Loaded inventory items:', data)
      setInventoryItems(data || [])
    } catch (error) {
      console.error('Error loading inventory items:', error)
    }
  }

  const loadTimeEntries = async (workOrderId: string) => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('work_order_id', workOrderId)
        .eq('user_id', currentUser.id)
        .order('start_time', { ascending: false })

      if (error) throw error
      
      const entries = data || []
      setTimeEntries(entries)
      
      // Check for active timer
      const active = entries.find(entry => !entry.end_time)
      setActiveTimer(active || null)
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

  const startTimer = async () => {
    if (!selectedJob || activeTimer) return

    try {
      // Get user's company_id from their profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.id)
        .single()

      if (profileError) throw profileError

      const { data, error } = await supabase
        .from('time_entries')
        .insert([{
          user_id: currentUser.id,
          company_id: userProfile.company_id,
          work_order_id: selectedJob.id,
          start_time: new Date().toISOString(),
          duration_minutes: 1,
          description: `Working on ${selectedJob.title}`,
          entry_type: 'work'
        }])
        .select()
        .single()

      if (error) throw error
      
      setActiveTimer(data)
      loadTimeEntries(selectedJob.id)
    } catch (error) {
      console.error('Error starting timer:', error)
    }
  }

  const stopTimer = async () => {
    if (!activeTimer) return

    try {
      const endTime = new Date()
      const startTime = new Date(activeTimer.start_time)
      const durationMinutes = Math.max(1, Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60)))

      const { error } = await supabase
        .from('time_entries')
        .update({
          end_time: endTime.toISOString(),
          duration_minutes: durationMinutes
        })
        .eq('id', activeTimer.id)

      if (error) throw error
      
      setActiveTimer(null)
      setTimerDisplay('00:00:00')
      if (selectedJob) {
        loadTimeEntries(selectedJob.id)
      }
    } catch (error) {
      console.error('Error stopping timer:', error)
    }
  }

  const uploadPhoto = async () => {
    if (!selectedFile || !selectedJob) return

    try {
      // In a real app, you'd upload to Supabase Storage first
      // For now, we'll simulate with a placeholder URL
      const photoUrl = `https://placeholder.com/photo-${Date.now()}.jpg`

      const { error } = await supabase
        .from('work_order_photos')
        .insert([{
          work_order_id: selectedJob.id,
          company_id: currentUser.profile.company_id,
          photo_url: photoUrl,
          caption: photoCaption,
          uploaded_by: currentUser.id
        }])

      if (error) throw error
      
      setSelectedFile(null)
      setPhotoCaption('')
      loadPhotos(selectedJob.id)
    } catch (error) {
      console.error('Error uploading photo:', error)
    }
  }

  const updateJobStatus = async () => {
    if (!selectedJob) return

    try {
      // First, update inventory quantities for parts used
      for (const [itemId, qtyUsed] of Object.entries(partsUsed)) {
        if (qtyUsed > 0) {
          const item = inventoryItems.find(i => i.id === itemId)
          if (item) {
            const newQuantity = Math.max(0, item.quantity - qtyUsed)
            await supabase
              .from('inventory_items')
              .update({ quantity: newQuantity })
              .eq('id', itemId)
          }
        }
      }

      const updateData: any = {
        status: jobStatus,
        actual_hours: parseFloat(hoursWorked) || null,
        notes: workNotes
      }

      if (jobStatus === 'completed') {
        updateData.completed_date = new Date().toISOString()
      }

      const { error } = await supabase
        .from('work_orders')
        .update(updateData)
        .eq('id', selectedJob.id)

      if (error) throw error
      
      setSelectedJob(null)
      loadMyJobs()
      alert('Job updated successfully!')
    } catch (error) {
      console.error('Error updating job:', error)
      alert('Error updating job')
    }
  }

  const convertToInvoice = async () => {
    if (!selectedJob) return

    try {
      // Calculate totals
      const laborCost = (parseFloat(invoiceFormData.labor_hours) || 0) * (parseFloat(invoiceFormData.labor_rate) || 0)
      const serviceCost = parseFloat(invoiceFormData.service_charge) || 0
      const subtotal = laborCost + serviceCost
      const taxAmount = subtotal * (parseFloat(invoiceFormData.tax_rate) || 0) / 100
      const total = subtotal + taxAmount

      // Get user's company_id from their profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.id)
        .single()

      if (profileError) throw profileError

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          company_id: userProfile.company_id,
          customer_id: selectedJob.customer_id,
          work_order_id: selectedJob.id,
          invoice_number: `INV-${Date.now()}`,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subtotal: subtotal,
          tax_amount: taxAmount,
          total_amount: total,
          status: 'draft',
          notes: invoiceFormData.notes
        }])
        .select()
        .single()

      if (invoiceError) throw invoiceError

      // Create invoice line items
      const lineItems = []

      // Add labor line item
      if (laborCost > 0) {
        lineItems.push({
          invoice_id: invoice.id,
          description: `Labor - ${selectedJob.title}`,
          quantity: parseFloat(invoiceFormData.labor_hours),
          unit_price: parseFloat(invoiceFormData.labor_rate),
          total: laborCost
        })
      }

      // Add service charge line item
      if (serviceCost > 0) {
        lineItems.push({
          invoice_id: invoice.id,
          description: 'Service Charge',
          quantity: 1,
          unit_price: serviceCost,
          total: serviceCost
        })
      }

      if (lineItems.length > 0) {
        const { error: lineItemsError } = await supabase
          .from('invoice_line_items')
          .insert(lineItems)

        if (lineItemsError) throw lineItemsError
      }

      setShowInvoiceModal(false)
      alert('Invoice created successfully!')
      
      // Navigate to invoices page
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'invoices' }))
    } catch (error) {
      console.error('Error creating invoice:', error)
      alert('Error creating invoice')
    }
  }

  // GPS tracking functions
  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    if (isTracking) return;
    
    setIsTracking(true);
    
    // Track location every 5 minutes (300000 ms)
    // For testing, you can reduce this to a shorter interval
    const trackerId = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        position => saveLocation(position),
        error => {
          console.error("Error getting location:", error);
          if (error.code === error.PERMISSION_DENIED) {
            alert("Location access denied. Please enable location permissions in your browser to use GPS tracking.");
            stopLocationTracking();
          }
        },
        { enableHighAccuracy: true }
      );
    }, 300000);
    
    // Also get location immediately
    navigator.geolocation.getCurrentPosition(
      position => saveLocation(position),
      error => {
        console.error("Error getting location:", error);
        if (error.code === error.PERMISSION_DENIED) {
          alert("Location access denied. Please enable location permissions in your browser to use GPS tracking.");
          stopLocationTracking();
        }
      },
      { enableHighAccuracy: true }
    );
    
    setLocationTrackerId(trackerId);
  };
  
  const stopLocationTracking = () => {
    if (locationTrackerId) {
      clearInterval(locationTrackerId);
      setLocationTrackerId(null);
    }
    setIsTracking(false);
  };
  
  const saveLocation = async (position: GeolocationPosition) => {
    try {
      const { latitude, longitude, accuracy } = position.coords;
      const timestamp = new Date().toISOString();
      
      // Get user's company_id from their profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.id)
        .single();

      if (profileError) throw profileError;
      
      // Save location to technician_locations table
      const { error } = await supabase
        .from('technician_locations')
        .insert([{
          technician_id: currentUser.id,
          company_id: userProfile.company_id,
          latitude,
          longitude,
          accuracy,
          timestamp
        }]);
        
      if (error) throw error;
      
      console.log("Location saved successfully");
    } catch (error) {
      console.error("Error saving location:", error);
    }
  };

  const openJobModal = (job: WorkOrder) => {
    setSelectedJob(job)
    setActiveTab('details')
    setJobStatus(job.status)
    setHoursWorked(job.actual_hours?.toString() || '')
    setWorkNotes(job.notes || '')
    setPartsUsed({})
    loadTimeEntries(job.id)
    loadPhotos(job.id)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-gray-100 text-gray-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'scheduled': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredJobs = workOrders.filter(job => {
    if (jobFilter === 'all') return true
    return job.status === jobFilter
  })

  const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.duration_minutes / 60), 0)

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
          <p className="text-gray-600">Manage your assigned work orders</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Jobs</option>
            <option value="open">Open</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          
          {/* GPS Tracking Toggle */}
          <button
            onClick={isTracking ? stopLocationTracking : startLocationTracking}
            className={`flex items-center px-3 py-2 rounded-lg border transition-colors ${
              isTracking 
                ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Navigation className={`w-4 h-4 mr-2 ${isTracking ? 'text-green-600' : 'text-gray-600'}`} />
            <span className="text-sm font-medium">
              {isTracking ? 'Stop GPS Tracking' : 'Start GPS Tracking'}
            </span>
          </button>
          
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewType('table')}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewType === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4 mr-1.5" />
              Table
            </button>
            <button
              onClick={() => setViewType('card')}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewType === 'card'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid className="w-4 h-4 mr-1.5" />
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Jobs Grid */}
      {viewType === 'table' ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Work Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
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
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{job.wo_number}</div>
                      <div className="text-sm text-gray-500">{job.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {job.customer?.customer_type === 'residential' 
                          ? `${job.customer?.first_name} ${job.customer?.last_name}`
                          : job.customer?.company_name
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                        {job.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(job.priority)}`}>
                        {job.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      {job.scheduled_date && (
                        <div className="text-sm text-gray-900">
                          {new Date(job.scheduled_date).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => openJobModal(job)}
                        className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110 flex items-center"
                      >
                        <Sparkles className="w-4 h-4 mr-1" /> <span className="text-xs font-medium">Manage</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredJobs.map((job, index) => (
            <div key={job.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-blue-600 mb-1">
                    {job.wo_number} • {job.customer?.customer_type === 'residential' 
                      ? `${job.customer?.first_name} ${job.customer?.last_name}`
                      : job.customer?.company_name
                    }
                  </h3>
                  <div className="flex space-x-2 mb-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                      {job.status.toUpperCase()}
                    </span>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(job.priority)}`}>
                      {job.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <User className="w-4 h-4 mr-2" />
                  <span>{currentUser?.profile?.first_name} {currentUser?.profile?.last_name} ({currentUser?.profile?.role})</span>
                </div>
                
                {job.scheduled_date && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>{new Date(job.scheduled_date).toLocaleDateString()} {new Date(job.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                
                {job.customer?.address && (
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span>{job.customer.address}</span>
                    <ExternalLink className="w-3 h-3 ml-1 text-blue-500" />
                  </div>
                )}
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-700">{job.title}</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {job.actual_hours ? `${job.actual_hours}h` : '0'}
                </div>
                <button
                  onClick={() => openJobModal(job)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Click to manage →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedJob.wo_number}</h3>
                  <p className="text-gray-600">{selectedJob.customer?.customer_type === 'residential' 
                    ? `${selectedJob.customer?.first_name} ${selectedJob.customer?.last_name}`
                    : selectedJob.customer?.company_name
                  }</p>
                  <p className="text-sm text-gray-500">{currentUser?.profile?.first_name} {currentUser?.profile?.last_name}</p>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {[
                  { id: 'details', label: 'Job Details', icon: FileText },
                  { id: 'time', label: 'Time Tracking', icon: Clock },
                  { id: 'photos', label: 'Photos', icon: Camera },
                  { id: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
                  { id: 'resolution', label: 'Resolution', icon: CheckCircle }
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
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'details' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Job Information</h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-700">WO Number:</span>
                        <span className="ml-2 text-sm text-gray-900">{selectedJob.wo_number}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Priority:</span>
                        <span className={`ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedJob.priority)}`}>
                          {selectedJob.priority.toUpperCase()}
                        </span>
                      </div>
                      {selectedJob.scheduled_date && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Scheduled:</span>
                          <span className="ml-2 text-sm text-gray-900">
                            {new Date(selectedJob.scheduled_date).toLocaleDateString()} {new Date(selectedJob.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-sm font-medium text-gray-700">Estimated Hours:</span>
                        <span className="ml-2 text-sm text-gray-900">Not specified</span>
                      </div>
                    </div>

                    <h5 className="text-md font-medium text-gray-900 mt-6 mb-3">Description</h5>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-700">{selectedJob.title}</p>
                    </div>

                    {/* Purchase Orders Section */}
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-md font-medium text-gray-900">Purchase Orders</h5>
                        <button
                          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'purchase-orders' }))}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View All POs
                        </button>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">
                          No purchase orders linked to this work order yet.
                        </p>
                        <button
                          onClick={() => {
                            // Store the work order ID for pre-filling the PO form
                            localStorage.setItem('preselected_work_order', selectedJob.id)
                            window.dispatchEvent(new CustomEvent('navigate', { detail: 'purchase-orders' }))
                          }}
                          className="mt-2 inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
                        >
                          <ShoppingCart className="w-4 h-4 mr-1" />
                          Create Purchase Order
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Customer Details</h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Email:</span>
                        <span className="ml-2 text-sm text-gray-900">{selectedJob.customer?.email || 'Not provided'}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Phone:</span>
                        <span className="ml-2 text-sm text-gray-900">{selectedJob.customer?.phone || 'Not provided'}</span>
                      </div>
                      {selectedJob.customer?.address && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Address:</span>
                          <div className="mt-1">
                            <p className="text-sm text-gray-900">{selectedJob.customer.address}</p>
                            <a 
                              href={`https://maps.google.com/?q=${encodeURIComponent(selectedJob.customer.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm flex items-center mt-1"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              View on Maps
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'time' && (
                <div className="text-center">
                  <h4 className="text-lg font-medium text-gray-900 mb-8">Time Tracking</h4>
                  
                  <div className="text-6xl font-mono text-blue-600 mb-8">
                    {timerDisplay}
                  </div>

                  <div className="mb-8">
                    {activeTimer ? (
                      <button
                        onClick={stopTimer}
                        className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Square className="w-5 h-5 mr-2" />
                        Stop Work
                      </button>
                    ) : (
                      <button
                        onClick={startTimer}
                        className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Play className="w-5 h-5 mr-2" />
                        Start Work
                      </button>
                    )}
                  </div>

                  <div className="text-left">
                    <h5 className="text-md font-medium text-gray-900 mb-3">Total Hours Worked</h5>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-2xl font-semibold text-gray-900">{totalHours.toFixed(1)}</p>
                    </div>
                  </div>
                  
                  {/* GPS Tracking Status */}
                  <div className="text-center mt-4">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                      isTracking ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      <Navigation className="w-4 h-4 mr-2" />
                      {isTracking ? 'GPS Tracking Active' : 'GPS Tracking Inactive'}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'photos' && (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-6">Job Photos</h4>
                  
                  <div className="mb-8">
                    <h5 className="text-md font-medium text-gray-900 mb-4">Add Photo</h5>
                    <div className="space-y-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      
                      <input
                        type="text"
                        placeholder="Describe this photo..."
                        value={photoCaption}
                        onChange={(e) => setPhotoCaption(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      
                      <button
                        onClick={uploadPhoto}
                        disabled={!selectedFile}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Photo
                      </button>
                    </div>
                  </div>

                  {photos.length === 0 ? (
                    <div className="text-center py-12">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No photos have been uploaded for this work order</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {photos.map((photo) => (
                        <div key={photo.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center mb-3">
                            <Camera className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-sm text-gray-700">{photo.caption}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(photo.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'purchase-orders' && (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-6">Purchase Orders for this Job</h4>
                  
                  <div className="mb-6">
                    <button
                      onClick={() => {
                        // Store the work order ID for pre-filling the PO form
                        localStorage.setItem('preselected_work_order', selectedJob.id)
                        window.dispatchEvent(new CustomEvent('navigate', { detail: 'purchase-orders' }))
                      }}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      Create Purchase Order
                    </button>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Purchase Orders</h3>
                    <p className="text-gray-600 mb-4">
                      No purchase orders have been created for this work order yet.
                    </p>
                    <p className="text-sm text-gray-500">
                      Create a purchase order to order parts and materials needed for this job.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'resolution' && (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-6">Job Status & Resolution</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Job Status
                      </label>
                      <select
                        value={jobStatus}
                        onChange={(e) => setJobStatus(e.target.value)}
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
                        Hours Worked
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={hoursWorked}
                        onChange={(e) => setHoursWorked(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Work Notes
                      </label>
                      <button className="text-blue-500 text-sm">✨ AI Assistant</button>
                    </div>
                    <textarea
                      value={workNotes}
                      onChange={(e) => setWorkNotes(e.target.value)}
                      rows={4}
                      placeholder="Add notes about the work performed..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Resolution Summary
                    </label>
                    <textarea
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      rows={4}
                      placeholder="Describe how the issue was resolved..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Parts & Materials Used */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="text-md font-medium text-gray-900">Parts & Materials Used</h5>
                      <button
                        type="button"
                        onClick={() => setShowPartsModal(true)}
                        className="inline-flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Manage Parts Used
                      </button>
                    </div>
                    
                    {Object.keys(partsUsed).length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h6 className="text-sm font-medium text-gray-900 mb-3">Items Used:</h6>
                        <div className="space-y-2">
                          {Object.entries(partsUsed).map(([itemId, quantity]) => {
                            const item = inventoryItems.find(i => i.id === itemId)
                            if (!item || quantity === 0) return null
                            return (
                              <div key={itemId} className="flex justify-between items-center text-sm">
                                <span className="text-gray-700">{item.name} (SKU: {item.sku})</span>
                                <span className="font-medium text-gray-900">
                                  Qty: {quantity} × ${item.unit_price.toFixed(2)} = ${(quantity * item.unit_price).toFixed(2)}
                                </span>
                              </div>
                            )
                          })}
                          <div className="pt-2 border-t border-gray-200">
                            <div className="flex justify-between items-center font-semibold">
                              <span>Total Parts Cost:</span>
                              <span className="text-green-600">
                                ${Object.entries(partsUsed).reduce((total, [itemId, quantity]) => {
                                  const item = inventoryItems.find(i => i.id === itemId)
                                  return total + (item ? quantity * item.unit_price : 0)
                                }, 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setSelectedJob(null)}
                      className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setShowInvoiceModal(true)}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Convert to Invoice
                    </button>
                    <button
                      onClick={updateJobStatus}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Update Job
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Convert to Invoice Modal */}
      {showInvoiceModal && selectedJob && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Convert Job to Invoice - {selectedJob.wo_number}
                </h3>
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Job Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-md font-medium text-gray-900 mb-2">Job Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Customer:</span>
                    <div className="text-gray-900">
                      {selectedJob.customer?.customer_type === 'residential' 
                        ? `${selectedJob.customer?.first_name} ${selectedJob.customer?.last_name}`
                        : selectedJob.customer?.company_name
                      }
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Job Title:</span>
                    <div className="text-gray-900">{selectedJob.title}</div>
                  </div>
                </div>
              </div>

              {/* Labor Information */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">Labor & Service</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hours Worked *
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={invoiceFormData.labor_hours}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, labor_hours: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="8.5"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Labor Rate ($/hour) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={invoiceFormData.labor_rate}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, labor_rate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="75.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Charge
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={invoiceFormData.service_charge}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, service_charge: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={invoiceFormData.tax_rate}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, tax_rate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="8.25"
                    />
                  </div>
                </div>
              </div>

              {/* Invoice Preview */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-md font-medium text-blue-900 mb-3">Invoice Preview</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Labor ({invoiceFormData.labor_hours || 0} hrs @ ${invoiceFormData.labor_rate || 0}/hr):</span>
                    <span className="font-medium text-blue-900">
                      ${((parseFloat(invoiceFormData.labor_hours) || 0) * (parseFloat(invoiceFormData.labor_rate) || 0)).toFixed(2)}
                    </span>
                  </div>
                  {parseFloat(invoiceFormData.service_charge) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-blue-700">Service Charge:</span>
                      <span className="font-medium text-blue-900">${(parseFloat(invoiceFormData.service_charge) || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-blue-200 pt-2">
                    <span className="text-blue-700">Subtotal:</span>
                    <span className="font-medium text-blue-900">
                      ${(((parseFloat(invoiceFormData.labor_hours) || 0) * (parseFloat(invoiceFormData.labor_rate) || 0)) + (parseFloat(invoiceFormData.service_charge) || 0)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Tax ({invoiceFormData.tax_rate || 0}%):</span>
                    <span className="font-medium text-blue-900">
                      ${((((parseFloat(invoiceFormData.labor_hours) || 0) * (parseFloat(invoiceFormData.labor_rate) || 0)) + (parseFloat(invoiceFormData.service_charge) || 0)) * (parseFloat(invoiceFormData.tax_rate) || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-blue-200 pt-2 text-lg">
                    <span className="font-bold text-blue-900">Total:</span>
                    <span className="font-bold text-blue-900">
                      ${(((parseFloat(invoiceFormData.labor_hours) || 0) * (parseFloat(invoiceFormData.labor_rate) || 0)) + (parseFloat(invoiceFormData.service_charge) || 0) + ((((parseFloat(invoiceFormData.labor_hours) || 0) * (parseFloat(invoiceFormData.labor_rate) || 0)) + (parseFloat(invoiceFormData.service_charge) || 0)) * (parseFloat(invoiceFormData.tax_rate) || 0) / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={invoiceFormData.notes}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Any additional notes for the invoice..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={convertToInvoice}
                  disabled={!invoiceFormData.labor_hours || !invoiceFormData.labor_rate}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parts Management Modal */}
      {showPartsModal && selectedJob && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  Parts & Materials Used - {selectedJob.wo_number}
                </h3>
                <button
                  onClick={() => setShowPartsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Available Inventory</h4>
                {inventoryItems.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No inventory items available</p>
                    <p className="text-sm text-gray-500 mt-1">Add items to inventory to track parts usage</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {inventoryItems.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h5 className="font-medium text-gray-900">{item.name}</h5>
                            <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                            <p className="text-sm text-gray-600">Available: {item.quantity}</p>
                            <p className="text-sm font-medium text-green-600">${item.unit_price.toFixed(2)} each</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Qty Used:</span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                const currentQty = partsUsed[item.id] || 0
                                if (currentQty > 0) {
                                  setPartsUsed(prev => ({
                                    ...prev,
                                    [item.id]: currentQty - 1
                                  }))
                                }
                              }}
                              className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-12 text-center font-medium">
                              {partsUsed[item.id] || 0}
                            </span>
                            <button
                              onClick={() => {
                                const currentQty = partsUsed[item.id] || 0
                                if (currentQty < item.quantity) {
                                  setPartsUsed(prev => ({
                                    ...prev,
                                    [item.id]: currentQty + 1
                                  }))
                                }
                              }}
                              className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
                              disabled={partsUsed[item.id] >= item.quantity}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {partsUsed[item.id] > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-sm font-medium text-gray-900">
                              Subtotal: ${(partsUsed[item.id] * item.unit_price).toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Parts Summary */}
              {Object.keys(partsUsed).some(id => partsUsed[id] > 0) && (
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Parts Usage Summary</h4>
                  <div className="space-y-2">
                    {Object.entries(partsUsed).map(([itemId, quantity]) => {
                      const item = inventoryItems.find(i => i.id === itemId)
                      if (!item || quantity === 0) return null
                      return (
                        <div key={itemId} className="flex justify-between items-center">
                          <span className="text-gray-700">{item.name} (SKU: {item.sku})</span>
                          <span className="font-medium text-gray-900">
                            {quantity} × ${item.unit_price.toFixed(2)} = ${(quantity * item.unit_price).toFixed(2)}
                          </span>
                        </div>
                      )
                    })}
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center font-semibold text-lg">
                        <span>Total Parts Cost:</span>
                        <span className="text-green-600">
                          ${Object.entries(partsUsed).reduce((total, [itemId, quantity]) => {
                            const item = inventoryItems.find(i => i.id === itemId)
                            return total + (item ? quantity * item.unit_price : 0)
                          }, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowPartsModal(false)}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}