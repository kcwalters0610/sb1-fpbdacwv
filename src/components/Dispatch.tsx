import React, { useState, useEffect } from 'react'
import { Calendar, MapPin, User, Clock, Phone, AlertTriangle, CheckCircle, Truck, Filter, Navigation, ChevronLeft, ChevronRight, Grid } from 'lucide-react'
import { supabase, WorkOrder, Profile } from '../lib/supabase'
import { format, startOfMonth, endOfMonth, addDays, startOfWeek, endOfWeek, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns'

interface DispatchWorkOrder extends WorkOrder {
  assigned_technician?: Profile
}

interface TechnicianLocation {
  technician_id: string
  latitude: number
  longitude: number
  accuracy: number
  timestamp: string
  technician?: Profile
}

export default function Dispatch() {
  const [workOrders, setWorkOrders] = useState<DispatchWorkOrder[]>([])
  const [technicians, setTechnicians] = useState<Profile[]>([])
  const [technicianLocations, setTechnicianLocations] = useState<TechnicianLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [selectedWorkOrders, setSelectedWorkOrders] = useState<string[]>([])
  const [notificationForm, setNotificationForm] = useState({
    message: ''
  })
  const [viewMode, setViewMode] = useState<'board' | 'calendar'>('board')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [calendarWorkOrders, setCalendarWorkOrders] = useState<DispatchWorkOrder[]>([])

  useEffect(() => {
    getCurrentUser()
    if (viewMode === 'board') {
      loadData()
    } else {
      loadCalendarData()
    }
  }, [selectedDate])

  useEffect(() => {
    if (viewMode === 'calendar') {
      loadCalendarData()
    }
  }, [currentMonth, viewMode])

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

  // Set up real-time subscription for technician locations
  useEffect(() => {
    const channel = supabase
      .channel('technician-locations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'technician_locations' },
        () => {
          loadTechnicianLocations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadData = async () => {
    try {
      const [ordersResult, techsResult, locationsResult] = await Promise.all([
        supabase
          .from('work_orders')
          .select(`
            *,
            customer:customers(*),
            assigned_technician:profiles!work_orders_assigned_to_fkey(*),
            project:projects(*),
            assigned_dept:departments!department_id(*)
          `)
          .gte('scheduled_date', selectedDate + 'T00:00:00')
          .lt('scheduled_date', selectedDate + 'T23:59:59')
          .order('scheduled_date'),
        supabase
          .from('profiles')
          .select('*')
          .in('role', ['tech', 'admin', 'manager'])
          .eq('is_active', true)
          .order('first_name'),
        loadTechnicianLocations()
      ])

      setWorkOrders(ordersResult.data || [])
      setTechnicians(techsResult.data || [])
    } catch (error) {
      console.error('Error loading dispatch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCalendarData = async () => {
    try {
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)
      
      const ordersResult = await supabase
        .from('work_orders')
        .select(`
          *,
          customer:customers(*),
          assigned_technician:profiles!work_orders_assigned_to_fkey(*),
          project:projects(*),
          assigned_dept:departments!department_id(*)
        `)
        .gte('scheduled_date', monthStart.toISOString())
        .lte('scheduled_date', monthEnd.toISOString())
        .order('scheduled_date')

      setCalendarWorkOrders(ordersResult.data || [])
    } catch (error) {
      console.error('Error loading calendar data:', error)
    }
  }

  const loadTechnicianLocations = async () => {
    try {
      // Get current user's company_id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile) return

      // Get the most recent location for each technician
      const { data, error } = await supabase.rpc('get_latest_technician_locations', {
        company_id_param: profile.company_id
      })

      if (error) throw error
      setTechnicianLocations(data || [])
      return data
    } catch (error) {
      console.error('Error loading technician locations:', error)
    }
  }

  const assignTechnician = async (workOrderId: string, technicianId: string) => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ assigned_to: technicianId })
        .eq('id', workOrderId)

      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error assigning technician:', error)
    }
  }

  const updateStatus = async (workOrderId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ status })
        .eq('id', workOrderId)

      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const bulkNotifyTechnicians = async () => {
    try {
      // TODO: Implement bulk notification functionality
      console.log('Sending notifications for work orders:', selectedWorkOrders)
      console.log('Message:', notificationForm.message)
      
      // Close modal and reset form
      setShowNotificationModal(false)
      setSelectedWorkOrders([])
      setNotificationForm({ message: '' })
    } catch (error) {
      console.error('Error sending notifications:', error)
    }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentMonth(subMonths(currentMonth, 1))
    } else {
      setCurrentMonth(addMonths(currentMonth, 1))
    }
  }

  const goToToday = () => {
    setCurrentMonth(new Date())
    setSelectedDate(new Date().toISOString().split('T')[0])
  }

  const getWorkOrdersForDate = (date: Date) => {
    return calendarWorkOrders.filter(order => 
      order.scheduled_date && isSameDay(new Date(order.scheduled_date), date)
    )
  }

  const renderCalendarView = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)
    
    const days = []
    let day = calendarStart
    
    while (day <= calendarEnd) {
      days.push(new Date(day))
      day = addDays(day, 1)
    }

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Calendar Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex items-center space-x-4">
              <button
                onClick={goToToday}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Today
              </button>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-6">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
              <div key={dayName} className="p-3 text-center text-sm font-medium text-gray-500">
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, dayIdx) => {
              const dayWorkOrders = getWorkOrdersForDate(day)
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isToday = isSameDay(day, new Date())
              const isSelected = isSameDay(day, new Date(selectedDate))

              return (
                <div
                  key={dayIdx}
                  onClick={() => setSelectedDate(format(day, 'yyyy-MM-dd'))}
                  className={`min-h-[120px] p-2 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'
                  } ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''} ${
                    isToday ? 'bg-blue-100' : ''
                  }`}
                >
                  <div className={`text-sm font-medium mb-2 ${
                    isToday ? 'text-blue-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  
                  <div className="space-y-1">
                    {dayWorkOrders.slice(0, 3).map((order) => (
                      <div
                        key={order.id}
                        className={`text-xs p-1 rounded truncate ${getPriorityColor(order.priority)} border`}
                        title={`${order.wo_number} - ${order.title}`}
                      >
                        <div className="font-medium">{order.wo_number}</div>
                        <div className="truncate">{order.title}</div>
                        {order.scheduled_date && (
                          <div className="text-xs opacity-75">
                            {format(new Date(order.scheduled_date), 'HH:mm')}
                          </div>
                        )}
                      </div>
                    ))}
                    {dayWorkOrders.length > 3 && (
                      <div className="text-xs text-gray-500 font-medium">
                        +{dayWorkOrders.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
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

  const filteredOrders = workOrders.filter(order => {
    if (statusFilter === 'all') return true
    return order.status === statusFilter
  })

  const groupedByTechnician = technicians.map(tech => ({
    technician: tech,
    orders: filteredOrders.filter(order => order.assigned_to === tech.id)
  }))

  const unassignedOrders = filteredOrders.filter(order => !order.assigned_to)

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
          <h1 className="text-2xl font-bold text-gray-900">Dispatch Board</h1>
          <p className="text-gray-600">Manage and assign work orders to technicians</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'board'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Truck className="w-4 h-4 mr-2" />
              Board
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Calendar
            </button>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
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
            <User className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Assigned</p>
              <p className="text-2xl font-bold text-gray-900">{workOrders.filter(o => o.assigned_to).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Unassigned</p>
              <p className="text-2xl font-bold text-gray-900">{unassignedOrders.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{workOrders.filter(o => o.status === 'completed').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Send Notification to Technicians
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Selected work orders: {selectedWorkOrders.length}
              </p>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  value={notificationForm.message}
                  onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter message to send to technicians..."
                  required
                />
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Work Orders:</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {selectedWorkOrders.map(woId => {
                    const wo = workOrders.find(w => w.id === woId)
                    return wo ? (
                      <div key={woId} className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                        {wo.wo_number} - {wo.title}
                      </div>
                    ) : null
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowNotificationModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={bulkNotifyTechnicians}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Send Notifications
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {viewMode === 'calendar' ? (
        renderCalendarView()
      ) : (
        /* Dispatch Board */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Unassigned Jobs */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-yellow-600" />
                Unassigned Jobs ({unassignedOrders.length})
              </h3>
            </div>
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {unassignedOrders.map((order) => (
                <div key={order.id} className={`border-2 rounded-lg p-4 ${getPriorityColor(order.priority)}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900">{order.wo_number}</h4>
                      <p className="text-sm text-gray-600">{order.title}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="w-4 h-4 mr-2" />
                      {order.customer?.customer_type === 'residential' 
                        ? `${order.customer?.first_name} ${order.customer?.last_name}`
                        : order.customer?.company_name
                      }
                    </div>
                    {order.scheduled_date && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="w-4 h-4 mr-2" />
                        {new Date(order.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {order.customer?.address && (
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mr-2" />
                        {order.customer.address}
                      </div>
                    )}
                  </div>

                  <select
                    onChange={(e) => e.target.value && assignTechnician(order.id, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    defaultValue=""
                    disabled={currentUser?.profile?.role === 'tech'}
                  >
                    <option value="">Assign Technician</option>
                    {technicians.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.first_name} {person.last_name} ({person.role})
                      </option>
                    ))}
                  </select>
                  {(currentUser?.profile?.role === 'admin' || currentUser?.profile?.role === 'manager' || currentUser?.profile?.role === 'office') && (
                    <button
                      onClick={() => {
                        // Navigate to work orders page to use full assignment modal
                        window.dispatchEvent(new CustomEvent('navigate', { detail: 'work-orders' }))
                      }}
                      className="mt-2 w-full px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                    >
                      Multi-Assign
                    </button>
                  )}
                </div>
              ))}
              {unassignedOrders.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p>All jobs are assigned!</p>
                </div>
              )}
            </div>
          </div>

          {/* Technician Columns */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupedByTechnician.map(({ technician, orders }) => (
                <div key={technician.id} className="bg-white rounded-lg border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">
                            {technician.first_name[0]}{technician.last_name[0]}
                          </span>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {technician.first_name} {technician.last_name}
                          </h3>
                          <p className="text-sm text-gray-600">{orders.length} jobs</p>
                        </div>
                      </div>
                      {technician.phone && (
                        <a
                          href={`tel:${technician.phone}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Phone className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                    {orders.map((order) => (
                      <div key={order.id} className={`border rounded-lg p-3 ${getPriorityColor(order.priority)}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900">{order.wo_number}</h4>
                            <p className="text-sm text-gray-600">{order.title}</p>
                          </div>
                          <select
                            value={order.status}
                            onChange={(e) => updateStatus(order.id, e.target.value)}
                            className={`text-xs font-medium rounded px-2 py-1 border-0 ${getStatusColor(order.status)}`}
                            disabled={currentUser?.profile?.role === 'tech'}
                          >
                            <option value="scheduled">Scheduled</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center text-sm text-gray-600">
                            <User className="w-3 h-3 mr-2" />
                            {order.customer?.customer_type === 'residential' 
                              ? `${order.customer?.first_name} ${order.customer?.last_name}`
                              : order.customer?.company_name
                            }
                          </div>
                          {order.scheduled_date && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Clock className="w-3 h-3 mr-2" />
                              {new Date(order.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {orders.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Truck className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">No jobs assigned</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected Date Work Orders (shown when calendar view is active) */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Work Orders for {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
            </h3>
          </div>
          <div className="p-6">
            {filteredOrders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.map((order) => (
                  <div key={order.id} className={`border-2 rounded-lg p-4 ${getPriorityColor(order.priority)}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">{order.wo_number}</h4>
                        <p className="text-sm text-gray-600">{order.title}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <User className="w-4 h-4 mr-2" />
                        {order.customer?.customer_type === 'residential' 
                          ? `${order.customer?.first_name} ${order.customer?.last_name}`
                          : order.customer?.company_name
                        }
                      </div>
                      {order.scheduled_date && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="w-4 h-4 mr-2" />
                          {new Date(order.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      {order.assigned_technician && (
                        <div className="flex items-center text-sm text-gray-600">
                          <User className="w-4 h-4 mr-2" />
                          {order.assigned_technician.first_name} {order.assigned_technician.last_name}
                        </div>
                      )}
                    </div>

                    {!order.assigned_to && (
                      <select
                        onChange={(e) => e.target.value && assignTechnician(order.id, e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        defaultValue=""
                        disabled={currentUser?.profile?.role === 'tech'}
                      >
                        <option value="">Assign Technician</option>
                        {technicians.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.first_name} {person.last_name} ({person.role})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No work orders scheduled</h3>
                <p>No work orders are scheduled for this date.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}