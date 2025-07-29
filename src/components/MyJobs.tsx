import React, { useState, useEffect } from 'react'
import { 
  Calendar, 
  MapPin, 
  User, 
  Clock, 
  Phone, 
  Mail, 
  CheckCircle, 
  AlertTriangle, 
  FileText,
  Camera,
  Upload,
  X,
  Plus,
  ShoppingCart,
  Eye,
  DollarSign,
  Package,
  Search,
  Filter,
  Truck,
  Minus,
  AlertCircle
} from 'lucide-react'
import { supabase, WorkOrder, Profile } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'

interface WorkOrderWithDetails extends WorkOrder {
  customer?: any
  assigned_technician?: Profile
  photos?: WorkOrderPhoto[]
  purchase_orders?: PurchaseOrder[]
  truck_inventory?: TruckInventoryItem[]
}

interface WorkOrderPhoto {
  id: string
  work_order_id: string
  photo_url: string
  caption?: string
  uploaded_by?: string
  created_at: string
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

interface TruckInventoryItem {
  id: string
  work_order_id: string
  inventory_item_id: string
  quantity_used: number
  notes?: string
  created_at: string
  inventory_item?: {
    name: string
    sku: string
    unit_price: number
  }
}

interface InventoryItem {
  id: string
  name: string
  sku: string
  quantity: number
  unit_price: number
}

export default function MyJobs() {
  const { viewType, setViewType } = useViewPreference('myJobs')
  const [workOrders, setWorkOrders] = useState<WorkOrderWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderWithDetails | null>(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showPOModal, setShowPOModal] = useState(false)
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  const [availableInventory, setAvailableInventory] = useState<InventoryItem[]>([])
  const [inventoryForm, setInventoryForm] = useState({
    inventory_item_id: '',
    quantity_used: 1,
    notes: ''
  })
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoCaption, setPhotoCaption] = useState('')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  useEffect(() => {
    getCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadMyWorkOrders()
      loadAvailableInventory()
    }
  }, [currentUser])

  const loadAvailableInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku, quantity, unit_price')
        .gt('quantity', 0)
        .order('name')

      if (error) throw error
      setAvailableInventory(data || [])
    } catch (error) {
      console.error('Error loading inventory:', error)
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

  const loadMyWorkOrders = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          customer:customers(*),
          assigned_technician:profiles!work_orders_assigned_to_fkey(*),
          customer_site:customer_sites(*)
        `)
        .eq('assigned_to', currentUser.id)
        .in('status', ['open', 'scheduled', 'in_progress', 'completed'])
        .order('scheduled_date', { ascending: true })

      if (error) throw error

      // Load photos, purchase orders, and truck inventory for each work order
      const workOrdersWithDetails = await Promise.all(
        (data || []).map(async (wo) => {
          // Load photos
          const { data: photos } = await supabase
            .from('work_order_photos')
            .select('*')
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

          // Load truck inventory
          const { data: truckInventory } = await supabase
            .from('truck_inventory')
            .select(`
              *,
              inventory_item:inventory_items(name, sku, unit_price)
            `)
            .eq('work_order_id', wo.id)
            .order('created_at', { ascending: false })

          return {
            ...wo,
            photos: photos || [],
            purchase_orders: purchaseOrders || [],
            truck_inventory: truckInventory || []
          }
        })
      )

      setWorkOrders(workOrdersWithDetails)
    } catch (error) {
      console.error('Error loading work orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateWorkOrderStatus = async (workOrderId: string, status: string) => {
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
      loadMyWorkOrders()
    } catch (error) {
      console.error('Error updating work order status:', error)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedWorkOrder) return

    setUploadingPhoto(true)
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file')
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB')
      }

      // Get file extension
      const fileExt = file.name.split('.').pop()
      const fileName = `${selectedWorkOrder.id}/${Date.now()}.${fileExt}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('work-order-photos')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('work-order-photos')
        .getPublicUrl(fileName)

      // Save photo record to database
      const { error: dbError } = await supabase
        .from('work_order_photos')
        .insert([{
          work_order_id: selectedWorkOrder.id,
          company_id: currentUser.profile.company_id,
          photo_url: publicUrl,
          caption: photoCaption || null,
          uploaded_by: currentUser.id
        }])

      if (dbError) throw dbError

      setPhotoCaption('')
      setShowPhotoModal(false)
      loadMyWorkOrders()
      
      // Update selected work order
      if (selectedWorkOrder) {
        const updatedWO = workOrders.find(wo => wo.id === selectedWorkOrder.id)
        if (updatedWO) {
          setSelectedWorkOrder(updatedWO)
        }
      }
    } catch (error) {
      console.error('Error uploading photo:', error)
      alert('Error uploading photo: ' + (error as Error).message)
    } finally {
      setUploadingPhoto(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const handleInventorySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWorkOrder) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile) throw new Error('Profile not found')

      // Add to truck inventory
      const { error: inventoryError } = await supabase
        .from('truck_inventory')
        .insert([{
          work_order_id: selectedWorkOrder.id,
          company_id: profile.company_id,
          inventory_item_id: inventoryForm.inventory_item_id,
          quantity_used: inventoryForm.quantity_used,
          notes: inventoryForm.notes || null,
          used_by: user.id
        }])

      if (inventoryError) throw inventoryError

      // Update inventory quantity
      const selectedItem = availableInventory.find(item => item.id === inventoryForm.inventory_item_id)
      if (selectedItem) {
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update({ 
            quantity: selectedItem.quantity - inventoryForm.quantity_used 
          })
          .eq('id', inventoryForm.inventory_item_id)

        if (updateError) throw updateError
      }

      setInventoryForm({
        inventory_item_id: '',
        quantity_used: 1,
        notes: ''
      })
      setShowInventoryModal(false)
      loadMyWorkOrders()
      loadAvailableInventory()
      
      // Update selected work order
      if (selectedWorkOrder) {
        const updatedWO = workOrders.find(wo => wo.id === selectedWorkOrder.id)
        if (updatedWO) {
          setSelectedWorkOrder(updatedWO)
        }
      }
    } catch (error) {
      console.error('Error adding inventory item:', error)
      alert('Error adding inventory item: ' + (error as Error).message)
    }
  }

  const saveResolutionNotes = async () => {
    if (!selectedWorkOrder) return

    setSavingNotes(true)
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ resolution_notes: resolutionNotes })
        .eq('id', selectedWorkOrder.id)

      if (error) throw error

      // Update local state
      setSelectedWorkOrder({
        ...selectedWorkOrder,
        resolution_notes: resolutionNotes
      })

      alert('Resolution notes saved successfully!')
    } catch (error) {
      console.error('Error saving resolution notes:', error)
      alert('Error saving resolution notes')
    } finally {
      setSavingNotes(false)
    }
  }

  const createPurchaseOrder = (workOrderId: string) => {
    // Store the work order ID for pre-selection in purchase orders
    localStorage.setItem('preselected_work_order', workOrderId)
    // Navigate to purchase orders page
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'purchase-orders' }))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
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

  // Filter work orders based on search term, status, and priority
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
          <p className="text-gray-600">Your assigned work orders and tasks</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search jobs..."
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workOrder.status)}`}>
                        {workOrder.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(workOrder.priority)}`}>
                        {workOrder.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {workOrder.scheduled_date ? new Date(workOrder.scheduled_date).toLocaleDateString() : 'Not scheduled'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-4 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Camera className="w-3 h-3 mr-1" />
                          {workOrder.photos?.length || 0}
                        </span>
                        <span className="flex items-center">
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          {workOrder.purchase_orders?.length || 0}
                        </span>
                        <span className="flex items-center">
                          <Truck className="w-3 h-3 mr-1" />
                          {workOrder.truck_inventory?.length || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedWorkOrder(workOrder)
                          setResolutionNotes(workOrder.resolution_notes || '')
                        }}
                        className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredWorkOrders.map((workOrder) => (
                <div 
                  key={workOrder.id} 
                  className={`bg-white rounded-lg border-2 p-6 hover:shadow-md transition-shadow cursor-pointer ${getPriorityColor(workOrder.priority)}`}
                  onClick={() => {
                    setSelectedWorkOrder(workOrder)
                    setResolutionNotes(workOrder.resolution_notes || '')
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {workOrder.wo_number}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">{workOrder.title}</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workOrder.status)}`}>
                        {workOrder.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(workOrder.priority)}`}>
                      {workOrder.priority.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
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

                    {workOrder.customer?.phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="w-4 h-4 mr-3" />
                        <span>{workOrder.customer.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex space-x-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <Camera className="w-3 h-3 mr-1" />
                        {workOrder.photos?.length || 0} photos
                      </span>
                      <span className="flex items-center">
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        {workOrder.purchase_orders?.length || 0} POs
                      </span>
                      <span className="flex items-center">
                        <Truck className="w-3 h-3 mr-1" />
                        {workOrder.truck_inventory?.length || 0} items
                      </span>
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

        {filteredWorkOrders.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {workOrders.length === 0 ? 'All caught up!' : 'No jobs match your filters'}
            </h3>
            <p className="text-gray-600">
              {workOrders.length === 0 
                ? 'You have no active work orders assigned to you.'
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Work Order Detail Modal */}
      {selectedWorkOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedWorkOrder.wo_number}
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
              {/* Status and Priority */}
              <div className="flex items-center space-x-4 mb-6">
                <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedWorkOrder.status)}`}>
                  {selectedWorkOrder.status.replace('_', ' ').toUpperCase()}
                </span>
                <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full border ${getPriorityColor(selectedWorkOrder.priority)}`}>
                  {selectedWorkOrder.priority.toUpperCase()} PRIORITY
                </span>
              </div>

              {/* Customer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Customer Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <User className="w-4 h-4 mr-3 text-gray-400" />
                      <span className="font-medium">
                        {selectedWorkOrder.customer?.customer_type === 'residential' 
                          ? `${selectedWorkOrder.customer?.first_name} ${selectedWorkOrder.customer?.last_name}`
                          : selectedWorkOrder.customer?.company_name
                        }
                      </span>
                    </div>
                    {selectedWorkOrder.customer?.email && (
                      <div className="flex items-center text-sm">
                        <Mail className="w-4 h-4 mr-3 text-gray-400" />
                        <span>{selectedWorkOrder.customer.email}</span>
                      </div>
                    )}
                    {selectedWorkOrder.customer?.phone && (
                      <div className="flex items-center text-sm">
                        <Phone className="w-4 h-4 mr-3 text-gray-400" />
                        <span>{selectedWorkOrder.customer.phone}</span>
                      </div>
                    )}
                    {selectedWorkOrder.customer?.address && (
                      <div className="flex items-center text-sm">
                        <MapPin className="w-4 h-4 mr-3 text-gray-400" />
                        <span>{selectedWorkOrder.customer.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Job Details</h4>
                  <div className="space-y-2">
                    {selectedWorkOrder.scheduled_date && (
                      <div className="flex items-center text-sm">
                        <Calendar className="w-4 h-4 mr-3 text-gray-400" />
                        <span>Scheduled: {new Date(selectedWorkOrder.scheduled_date).toLocaleString()}</span>
                      </div>
                    )}
                    {selectedWorkOrder.customer_site && (
                      <div className="flex items-center text-sm">
                        <MapPin className="w-4 h-4 mr-3 text-gray-400" />
                        <span>Site: {selectedWorkOrder.customer_site.site_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedWorkOrder.description && (
                <div className="mb-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Description</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">{selectedWorkOrder.description}</p>
                  </div>
                </div>
              )}

              {/* Resolution Notes */}
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-3">Resolution Notes</h4>
                <div className="space-y-3">
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add notes about the work performed, issues found, or resolution details..."
                  />
                  <button
                    onClick={saveResolutionNotes}
                    disabled={savingNotes}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {savingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>

              {/* Photos Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-medium text-gray-900">Photos ({selectedWorkOrder.photos?.length || 0})</h4>
                  <button
                    onClick={() => setShowPhotoModal(true)}
                    className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Add Photo
                  </button>
                </div>
                
                {selectedWorkOrder.photos && selectedWorkOrder.photos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Camera className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No photos uploaded yet</p>
                  </div>
                )}
              </div>

              {/* Purchase Orders Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-medium text-gray-900">Purchase Orders ({selectedWorkOrder.purchase_orders?.length || 0})</h4>
                  <button
                    onClick={() => createPurchaseOrder(selectedWorkOrder.id)}
                    className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create PO
                  </button>
                </div>
                
                {selectedWorkOrder.purchase_orders && selectedWorkOrder.purchase_orders.length > 0 ? (
                  <div className="space-y-3">
                    {selectedWorkOrder.purchase_orders.map((po) => (
                      <div key={po.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">{po.po_number}</h5>
                            <p className="text-sm text-gray-600">{po.vendor?.name}</p>
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
                    <p>No purchase orders created yet</p>
                  </div>
                )}
              </div>

              {/* Truck Inventory Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-medium text-gray-900">Truck Inventory ({selectedWorkOrder.truck_inventory?.length || 0})</h4>
                  <button
                    onClick={() => setShowInventoryModal(true)}
                    className="inline-flex items-center px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Add Item
                  </button>
                </div>
                
                {selectedWorkOrder.truck_inventory && selectedWorkOrder.truck_inventory.length > 0 ? (
                  <div className="space-y-3">
                    {selectedWorkOrder.truck_inventory.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">{item.inventory_item?.name}</h5>
                            <p className="text-sm text-gray-600">SKU: {item.inventory_item?.sku}</p>
                            <p className="text-sm text-gray-600">Quantity Used: {item.quantity_used}</p>
                            {item.notes && (
                              <p className="text-sm text-gray-500 mt-1">{item.notes}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">
                              ${((item.inventory_item?.unit_price || 0) * item.quantity_used).toFixed(2)}
                            </p>
                            <p className="text-sm text-gray-500">
                              ${item.inventory_item?.unit_price?.toFixed(2)} each
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">Total Materials Cost:</span>
                        <span className="font-bold text-lg text-green-600">
                          ${selectedWorkOrder.truck_inventory.reduce((sum, item) => 
                            sum + ((item.inventory_item?.unit_price || 0) * item.quantity_used), 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Truck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No inventory items used yet</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                <div className="flex space-x-3">
                  {selectedWorkOrder.status === 'scheduled' && (
                    <button
                      onClick={() => updateWorkOrderStatus(selectedWorkOrder.id, 'in_progress')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Start Job
                    </button>
                  )}
                  {selectedWorkOrder.status === 'in_progress' && (
                    <button
                      onClick={() => updateWorkOrderStatus(selectedWorkOrder.id, 'completed')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
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

      {/* Photo Upload Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Upload Photo</h3>
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
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <div className="text-sm text-gray-600 mb-2">
                      <label htmlFor="photo-upload" className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                        Click to upload
                      </label>
                      <span> or drag and drop</span>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    <input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploadingPhoto}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={uploadingPhoto}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Modal */}
      {showInventoryModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Add Inventory Item</h3>
                <button
                  onClick={() => setShowInventoryModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleInventorySubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Inventory Item *
                  </label>
                  <select
                    value={inventoryForm.inventory_item_id}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, inventory_item_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Item</option>
                    {availableInventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} - {item.sku} (Stock: {item.quantity})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity Used *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={inventoryForm.quantity_used}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, quantity_used: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={inventoryForm.notes}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional notes about usage..."
                  />
                </div>

                {inventoryForm.inventory_item_id && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-sm">
                      <div className="font-medium text-blue-900">Cost Calculation:</div>
                      <div className="text-blue-700">
                        {(() => {
                          const item = availableInventory.find(i => i.id === inventoryForm.inventory_item_id)
                          const cost = (item?.unit_price || 0) * inventoryForm.quantity_used
                          return `${inventoryForm.quantity_used} × $${item?.unit_price?.toFixed(2)} = $${cost.toFixed(2)}`
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowInventoryModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}