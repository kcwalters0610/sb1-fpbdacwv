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
  Trash2,
  ShoppingCart,
  FileText,
  DollarSign,
  Receipt
} from 'lucide-react'
import { supabase, WorkOrder, Profile } from '../lib/supabase'
import { getNextNumber, updateNextNumber } from '../lib/numbering'

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

interface Vendor {
  id: string
  name: string
  contact_person?: string
  email?: string
  phone?: string
}

export default function MyJobs() {
  const [workOrders, setWorkOrders] = useState<MyJobsWorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<MyJobsWorkOrder | null>(null)
  const [statusFilter, setStatusFilter] = useState('active')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showPOModal, setShowPOModal] = useState(false)
  const [showDescriptionModal, setShowDescriptionModal] = useState(false)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [photos, setPhotos] = useState<WorkOrderPhoto[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [savingDescription, setSavingDescription] = useState(false)
  const [workOrderDescription, setWorkOrderDescription] = useState('')
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertingToInvoice, setConvertingToInvoice] = useState(false)
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])

  const [timeForm, setTimeForm] = useState({
    start_time: '',
    end_time: '',
    duration_minutes: 0,
    description: ''
  })

  const [photoForm, setPhotoForm] = useState({
    caption: ''
  })

  const [poForm, setPOForm] = useState({
    vendor_id: '',
    expected_delivery: '',
    notes: '',
    items: [{ description: '', quantity: 1, unit_price: 0 }]
  })

  useEffect(() => {
    getCurrentUser()
    loadVendors()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadMyJobs()
    }
  }, [currentUser, statusFilter])

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, contact_person, email, phone')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setVendors(data || [])
    } catch (error) {
      console.error('Error loading vendors:', error)
    }
  }

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

  const openDescriptionModal = (workOrder: MyJobsWorkOrder) => {
    setSelectedOrder(workOrder)
    setWorkOrderDescription(workOrder.description || '')
    setShowDescriptionModal(true)
  }

  const saveDescription = async () => {
    if (!selectedOrder) return
    
    setSavingDescription(true)
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ description: workOrderDescription })
        .eq('id', selectedOrder.id)
      
      if (error) throw error
      
      // Update the local state
      setWorkOrders(prev => prev.map(wo => 
        wo.id === selectedOrder.id 
          ? { ...wo, description: workOrderDescription }
          : wo
      ))
      
      setShowDescriptionModal(false)
      setSelectedOrder(null)
    } catch (error) {
      console.error('Error saving description:', error)
      alert('Error saving description')
    } finally {
      setSavingDescription(false)
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

  const handlePOSubmit = async (e: React.FormEvent) => {
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

      // Generate PO number
      const { formattedNumber: poNumber, nextSequence } = await getNextNumber('purchase_order')

      // Calculate totals
      const subtotal = poForm.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
      const taxAmount = 0 // No tax calculation for now
      const totalAmount = subtotal + taxAmount

      // Create purchase order
      const poData = {
        company_id: profile.company_id,
        vendor_id: poForm.vendor_id,
        work_order_id: selectedOrder.id,
        po_number: poNumber,
        status: 'draft',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery: poForm.expected_delivery || null,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: poForm.notes || null
      }

      const { data: newPO, error: poError } = await supabase
        .from('purchase_orders')
        .insert([poData])
        .select()
        .single()

      if (poError) throw poError

      // Create purchase order items
      const itemsData = poForm.items.map(item => ({
        purchase_order_id: newPO.id,
        company_id: profile.company_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price
      }))

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsData)

      if (itemsError) throw itemsError

      // Update the sequence number
      await updateNextNumber('purchase_order', nextSequence)

      setShowPOModal(false)
      resetPOForm()
      alert(`Purchase order ${poNumber} created successfully!`)
    } catch (error) {
      console.error('Error creating purchase order:', error)
      alert('Error creating purchase order. Please try again.')
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

  const resetPOForm = () => {
    setPOForm({
      vendor_id: '',
      expected_delivery: '',
      notes: '',
      items: [{ description: '', quantity: 1, unit_price: 0 }]
    })
  }

  const addPOItem = () => {
    setPOForm({
      ...poForm,
      items: [...poForm.items, { description: '', quantity: 1, unit_price: 0 }]
    })
  }

  const removePOItem = (index: number) => {
    if (poForm.items.length > 1) {
      setPOForm({
        ...poForm,
        items: poForm.items.filter((_, i) => i !== index)
      })
    }
  }

  const updatePOItem = (index: number, field: string, value: any) => {
    const updatedItems = [...poForm.items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    setPOForm({ ...poForm, items: updatedItems })
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

  const openConvertModal = async (workOrder: MyJobsWorkOrder) => {
    setSelectedOrder(workOrder)
    setShowConvertModal(true)
    
    // Load related purchase orders and time entries
    try {
      const [poResult, timeResult] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select(`
            *,
            items:purchase_order_items(*)
          `)
          .eq('work_order_id', workOrder.id),
        supabase
          .from('time_entries')
          .select(`
            *,
            user:profiles(first_name, last_name, role)
          `)
          .eq('work_order_id', workOrder.id)
          .eq('status', 'approved')
      ])
      
      setPurchaseOrders(poResult.data || [])
      setTimeEntries(timeResult.data || [])
    } catch (error) {
      console.error('Error loading conversion data:', error)
    }
  }

  const convertToInvoice = async () => {
    if (!selectedOrder) return
    
    setConvertingToInvoice(true)
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
      
      // Calculate totals from purchase orders and time entries
      let subtotal = 0
      
      // Add purchase order costs
      purchaseOrders.forEach(po => {
        subtotal += po.total_amount || 0
      })
      
      // Add labor costs from time entries
      timeEntries.forEach(entry => {
        const hours = entry.duration_minutes / 60
        // Use a default rate of $75/hour - in a real app, you'd get this from labor rates
        subtotal += hours * 75
      })
      
      const taxRate = 0.08 // 8% tax rate - should be configurable
      const taxAmount = subtotal * taxRate
      const totalAmount = subtotal + taxAmount
      
      // Create invoice
      const invoiceData = {
        company_id: profile.company_id,
        customer_id: selectedOrder.customer_id,
        work_order_id: selectedOrder.id,
        invoice_number: invoiceNumber,
        status: 'draft',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
        subtotal: subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: `Generated from Work Order: ${selectedOrder.wo_number}`
      }
      
      const { error } = await supabase
        .from('invoices')
        .insert([invoiceData])
      
      if (error) throw error
      
      // Update the sequence number
      await updateNextNumber('invoice', nextSequence)
      
      // Update work order status to completed if not already
      if (selectedOrder.status !== 'completed') {
        await supabase
          .from('work_orders')
          .update({ 
            status: 'completed',
            completed_date: new Date().toISOString()
          })
          .eq('id', selectedOrder.id)
      }
      
      setShowConvertModal(false)
      setSelectedOrder(null)
      loadMyJobs()
      
      alert(`Invoice ${invoiceNumber} created successfully! Subtotal: $${subtotal.toFixed(2)}, Total: $${totalAmount.toFixed(2)}`)
    } catch (error) {
      console.error('Error converting to invoice:', error)
      alert('Error converting work order to invoice: ' + (error as Error).message)
    } finally {
      setConvertingToInvoice(false)
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
                    <button
                      onClick={() => setShowPOModal(true)}
                      className="w-full inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      Create Purchase Order
                    </button>
                    <button
                      onClick={() => openDescriptionModal(selectedOrder)}
                      className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <FileText className="w-5 h-5 mr-2" />
                      Edit Description
                    </button>
                    {selectedOrder.status === 'completed' && (
                      <button
                        onClick={() => openConvertModal(selectedOrder)}
                        className="w-full inline-flex items-center justify-center px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                      >
                        <Receipt className="w-5 h-5 mr-2" />
                        Convert to Invoice
                      </button>
                    )}
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

      {/* Purchase Order Modal */}
      {showPOModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create Purchase Order</h3>
              <p className="text-sm text-gray-600 mt-1">For work order: {selectedOrder?.wo_number}</p>
              <p className="text-sm text-gray-600 mt-1">
                Customer: {selectedOrder?.customer?.customer_type === 'residential' 
                  ? `${selectedOrder?.customer?.first_name} ${selectedOrder?.customer?.last_name}`
                  : selectedOrder?.customer?.company_name || 'Unknown Customer'
                }
              </p>
            </div>
            
            <form onSubmit={handlePOSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vendor *
                  </label>
                  <select
                    value={poForm.vendor_id}
                    onChange={(e) => setPOForm({ ...poForm, vendor_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expected Delivery
                  </label>
                  <input
                    type="date"
                    value={poForm.expected_delivery}
                    onChange={(e) => setPOForm({ ...poForm, expected_delivery: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-900">Items</h4>
                  <button
                    type="button"
                    onClick={addPOItem}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-4">
                  {poForm.items.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-medium text-gray-700">Item {index + 1}</h5>
                        {poForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePOItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Description *
                          </label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updatePOItem(index, 'description', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="Item description"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Quantity *
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => updatePOItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Unit Price *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updatePOItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="0.00"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Total
                          </label>
                          <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900">
                            ${(item.quantity * item.unit_price).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* PO Total */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-md font-medium text-gray-900">Total Amount:</span>
                    <span className="text-lg font-bold text-gray-900">
                      ${poForm.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={poForm.notes}
                  onChange={(e) => setPOForm({ ...poForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional notes for this purchase order..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowPOModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Create Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Description Modal */}
      {showDescriptionModal && selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Work Order Description - {selectedOrder.wo_number}
                </h3>
                <button
                  onClick={() => setShowDescriptionModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <h4 className="text-md font-medium text-gray-900 mb-2">Job Title</h4>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {selectedOrder.title}
                </p>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Description & Notes
                </label>
                <textarea
                  value={workOrderDescription}
                  onChange={(e) => setWorkOrderDescription(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add detailed description of work performed, issues found, parts used, recommendations, etc..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Document work performed, issues encountered, and any recommendations for the customer.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDescriptionModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveDescription}
                  disabled={savingDescription}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {savingDescription ? 'Saving...' : 'Save Description'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Invoice Modal */}
      {showConvertModal && selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Convert Work Order to Invoice - {selectedOrder.wo_number}
                </h3>
                <button
                  onClick={() => setShowConvertModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Work Order Info */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Work Order Details</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">WO Number:</span>
                      <span className="text-sm text-gray-900">{selectedOrder.wo_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Title:</span>
                      <span className="text-sm text-gray-900">{selectedOrder.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Customer:</span>
                      <span className="text-sm text-gray-900">
                        {selectedOrder.customer?.customer_type === 'residential' 
                          ? `${selectedOrder.customer?.first_name} ${selectedOrder.customer?.last_name}`
                          : selectedOrder.customer?.company_name
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Status:</span>
                      <span className="text-sm text-gray-900">{selectedOrder.status}</span>
                    </div>
                  </div>
                </div>

                {/* Invoice Preview */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Invoice Preview</h4>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="space-y-3">
                      {/* Labor Costs */}
                      {timeEntries.length > 0 && (
                        <div>
                          <h5 className="text-sm font-semibold text-gray-900 mb-2">Labor Costs</h5>
                          {timeEntries.map((entry) => (
                            <div key={entry.id} className="flex justify-between text-sm">
                              <span className="text-gray-700">
                                {entry.user?.first_name} {entry.user?.last_name} - {(entry.duration_minutes / 60).toFixed(1)}h
                              </span>
                              <span className="text-gray-900 font-medium">
                                ${((entry.duration_minutes / 60) * 75).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Purchase Order Costs */}
                      {purchaseOrders.length > 0 && (
                        <div>
                          <h5 className="text-sm font-semibold text-gray-900 mb-2">Materials & Parts</h5>
                          {purchaseOrders.map((po) => (
                            <div key={po.id} className="flex justify-between text-sm">
                              <span className="text-gray-700">PO: {po.po_number}</span>
                              <span className="text-gray-900 font-medium">${(po.total_amount || 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Totals */}
                      <div className="border-t border-blue-200 pt-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">Subtotal:</span>
                          <span className="text-gray-900 font-medium">
                            ${(() => {
                              const laborCost = timeEntries.reduce((sum, entry) => sum + ((entry.duration_minutes / 60) * 75), 0)
                              const materialCost = purchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0)
                              return (laborCost + materialCost).toFixed(2)
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">Tax (8%):</span>
                          <span className="text-gray-900 font-medium">
                            ${(() => {
                              const laborCost = timeEntries.reduce((sum, entry) => sum + ((entry.duration_minutes / 60) * 75), 0)
                              const materialCost = purchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0)
                              const subtotal = laborCost + materialCost
                              return (subtotal * 0.08).toFixed(2)
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t border-blue-300 pt-2">
                          <span className="text-gray-900">Total:</span>
                          <span className="text-blue-600">
                            ${(() => {
                              const laborCost = timeEntries.reduce((sum, entry) => sum + ((entry.duration_minutes / 60) * 75), 0)
                              const materialCost = purchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0)
                              const subtotal = laborCost + materialCost
                              return (subtotal * 1.08).toFixed(2)
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowConvertModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={convertToInvoice}
                  disabled={convertingToInvoice}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {convertingToInvoice ? 'Converting...' : 'Create Invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}