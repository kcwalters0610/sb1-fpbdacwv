import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, Settings, PenTool as Tool, Calendar, CheckCircle, Clock, AlertTriangle, Edit, Trash2, User, Building2, FileText, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Maintenance() {
  const [activeTab, setActiveTab] = useState('equipment')
  const [loading, setLoading] = useState(true)
  const [equipment, setEquipment] = useState<any[]>([])
  const [maintenanceTasks, setMaintenanceTasks] = useState<any[]>([])
  const [maintenanceSchedules, setMaintenanceSchedules] = useState<any[]>([])
  const [maintenanceLogs, setMaintenanceLogs] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  
  // Equipment form
  const [showEquipmentForm, setShowEquipmentForm] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState<any>(null)
  const [equipmentForm, setEquipmentForm] = useState({
    name: '',
    model_number: '',
    serial_number: '',
    unit_number: '',
    manufacturer: '',
    installation_date: '',
    location: '',
    status: 'active',
    notes: '',
    customer_id: ''
  })
  
  // Task form
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<any>(null)
  const [taskForm, setTaskForm] = useState({
    name: '',
    description: '',
    estimated_duration_minutes: 60,
    is_active: true
  })
  
  // Schedule form
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<any>(null)
  const [scheduleForm, setScheduleForm] = useState({
    equipment_id: '',
    task_id: '',
    frequency: 'monthly',
    next_due_date: ''
  })
  
  // Log form
  const [showLogForm, setShowLogForm] = useState(false)
  const [editingLog, setEditingLog] = useState<any>(null)
  const [logForm, setLogForm] = useState({
    equipment_id: '',
    task_id: '',
    schedule_id: '',
    performed_by: '',
    performed_date: new Date().toISOString().split('T')[0],
    notes: '',
    status: 'completed'
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Get current user's company_id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()
      
      if (!profile) return
      
      // Load equipment
      const { data: equipmentData } = await supabase
        .from('equipment')
        .select(`
          *,
          customer:customers(*)
        `)
        .order('name', { ascending: true })
      
      setEquipment(equipmentData || [])
      
      // Load maintenance tasks
      const { data: tasksData } = await supabase
        .from('maintenance_tasks')
        .select('*')
        .order('name', { ascending: true })
      
      setMaintenanceTasks(tasksData || [])
      
      // Load maintenance schedules with related data
      const { data: schedulesData } = await supabase
        .from('maintenance_schedules')
        .select(`
          *,
          equipment(*),
          task:maintenance_tasks(*)
        `)
        .order('next_due_date', { ascending: true })
      
      setMaintenanceSchedules(schedulesData || [])
      
      // Load maintenance logs with related data
      const { data: logsData } = await supabase
        .from('maintenance_logs')
        .select(`
          *,
          equipment(*),
          task:maintenance_tasks(*),
          technician:profiles(*)
        `)
        .order('performed_date', { ascending: false })
      
      setMaintenanceLogs(logsData || [])
      
      // Load customers for equipment form
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, first_name, last_name, company_name, customer_type')
        .order('first_name', { ascending: true })
      
      setCustomers(customersData || [])
      
      // Load technicians for log form
      const { data: techniciansData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .eq('is_active', true)
        .order('first_name', { ascending: true })
      
      setTechnicians(techniciansData || [])
    } catch (error) {
      console.error('Error loading maintenance data:', error)
    } finally {
      setLoading(false)
    }
  }

  // EQUIPMENT CRUD OPERATIONS
  const handleEquipmentSubmit = async (e: React.FormEvent) => {
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
      
      if (!profile) throw new Error('Profile not found')
      
      const equipmentData = {
        ...equipmentForm,
        company_id: profile.company_id
      }
      
      if (editingEquipment) {
        const { error } = await supabase
          .from('equipment')
          .update(equipmentData)
          .eq('id', editingEquipment.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('equipment')
          .insert([equipmentData])
        
        if (error) throw error
      }
      
      setShowEquipmentForm(false)
      setEditingEquipment(null)
      resetEquipmentForm()
      loadData()
    } catch (error) {
      console.error('Error saving equipment:', error)
      alert('Error saving equipment')
    } finally {
      setLoading(false)
    }
  }
  
  const deleteEquipment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this equipment? This will also delete all related maintenance schedules and logs.')) return
    
    try {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting equipment:', error)
      alert('Error deleting equipment')
    }
  }
  
  const resetEquipmentForm = () => {
    setEquipmentForm({
      name: '',
      model_number: '',
      serial_number: '',
      unit_number: '',
      manufacturer: '',
      installation_date: '',
      location: '',
      status: 'active',
      notes: '',
      customer_id: ''
    })
  }
  
  // TASK CRUD OPERATIONS
  const handleTaskSubmit = async (e: React.FormEvent) => {
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
      
      if (!profile) throw new Error('Profile not found')
      
      const taskData = {
        ...taskForm,
        company_id: profile.company_id
      }
      
      if (editingTask) {
        const { error } = await supabase
          .from('maintenance_tasks')
          .update(taskData)
          .eq('id', editingTask.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('maintenance_tasks')
          .insert([taskData])
        
        if (error) throw error
      }
      
      setShowTaskForm(false)
      setEditingTask(null)
      resetTaskForm()
      loadData()
    } catch (error) {
      console.error('Error saving maintenance task:', error)
      alert('Error saving maintenance task')
    } finally {
      setLoading(false)
    }
  }
  
  const deleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this maintenance task? This will also delete all related maintenance schedules and logs.')) return
    
    try {
      const { error } = await supabase
        .from('maintenance_tasks')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting maintenance task:', error)
      alert('Error deleting maintenance task')
    }
  }
  
  const resetTaskForm = () => {
    setTaskForm({
      name: '',
      description: '',
      estimated_duration_minutes: 60,
      is_active: true
    })
  }
  
  // SCHEDULE CRUD OPERATIONS
  const handleScheduleSubmit = async (e: React.FormEvent) => {
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
      
      if (!profile) throw new Error('Profile not found')
      
      const scheduleData = {
        ...scheduleForm,
        company_id: profile.company_id
      }
      
      if (editingSchedule) {
        const { error } = await supabase
          .from('maintenance_schedules')
          .update(scheduleData)
          .eq('id', editingSchedule.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('maintenance_schedules')
          .insert([scheduleData])
        
        if (error) throw error
      }
      
      setShowScheduleForm(false)
      setEditingSchedule(null)
      resetScheduleForm()
      loadData()
    } catch (error) {
      console.error('Error saving maintenance schedule:', error)
      alert('Error saving maintenance schedule')
    } finally {
      setLoading(false)
    }
  }
  
  const deleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this maintenance schedule?')) return
    
    try {
      const { error } = await supabase
        .from('maintenance_schedules')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting maintenance schedule:', error)
      alert('Error deleting maintenance schedule')
    }
  }
  
  const resetScheduleForm = () => {
    setScheduleForm({
      equipment_id: '',
      task_id: '',
      frequency: 'monthly',
      next_due_date: ''
    })
  }
  
  // LOG CRUD OPERATIONS
  const handleLogSubmit = async (e: React.FormEvent) => {
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
      
      if (!profile) throw new Error('Profile not found')
      
      const logData = {
        ...logForm,
        company_id: profile.company_id,
        performed_by: logForm.performed_by || user.id
      }
      
      if (editingLog) {
        const { error } = await supabase
          .from('maintenance_logs')
          .update(logData)
          .eq('id', editingLog.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('maintenance_logs')
          .insert([logData])
        
        if (error) throw error
        
        // Update last_performed_date in schedule if schedule_id is provided
        if (logForm.schedule_id) {
          const { error: updateError } = await supabase
            .from('maintenance_schedules')
            .update({ 
              last_performed_date: logForm.performed_date,
              // Calculate next due date based on frequency
              next_due_date: calculateNextDueDate(logForm.performed_date, 
                maintenanceSchedules.find(s => s.id === logForm.schedule_id)?.frequency || 'monthly')
            })
            .eq('id', logForm.schedule_id)
          
          if (updateError) throw updateError
        }
      }
      
      setShowLogForm(false)
      setEditingLog(null)
      resetLogForm()
      loadData()
    } catch (error) {
      console.error('Error saving maintenance log:', error)
      alert('Error saving maintenance log')
    } finally {
      setLoading(false)
    }
  }
  
  const deleteLog = async (id: string) => {
    if (!confirm('Are you sure you want to delete this maintenance log?')) return
    
    try {
      const { error } = await supabase
        .from('maintenance_logs')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting maintenance log:', error)
      alert('Error deleting maintenance log')
    }
  }
  
  const resetLogForm = () => {
    setLogForm({
      equipment_id: '',
      task_id: '',
      schedule_id: '',
      performed_by: '',
      performed_date: new Date().toISOString().split('T')[0],
      notes: '',
      status: 'completed'
    })
  }
  
  // HELPER FUNCTIONS
  const calculateNextDueDate = (currentDate: string, frequency: string) => {
    const date = new Date(currentDate)
    
    switch (frequency) {
      case 'weekly':
        date.setDate(date.getDate() + 7)
        break
      case 'monthly':
        date.setMonth(date.getMonth() + 1)
        break
      case 'quarterly':
        date.setMonth(date.getMonth() + 3)
        break
      case 'biannual':
        date.setMonth(date.getMonth() + 6)
        break
      case 'annual':
        date.setFullYear(date.getFullYear() + 1)
        break
      default:
        date.setMonth(date.getMonth() + 1)
    }
    
    return date.toISOString().split('T')[0]
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'completed':
        return 'text-green-700 bg-green-100'
      case 'inactive':
      case 'incomplete':
        return 'text-red-700 bg-red-100'
      case 'maintenance':
      case 'needs_followup':
        return 'text-yellow-700 bg-yellow-100'
      case 'decommissioned':
        return 'text-gray-700 bg-gray-100'
      default:
        return 'text-blue-700 bg-blue-100'
    }
  }
  
  const getScheduleStatusColor = (schedule: any) => {
    if (!schedule.next_due_date) return 'text-gray-700 bg-gray-100'
    
    const today = new Date()
    const dueDate = new Date(schedule.next_due_date)
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return 'text-red-700 bg-red-100' // Overdue
    if (diffDays < 7) return 'text-yellow-700 bg-yellow-100' // Due soon
    return 'text-green-700 bg-green-100' // Due later
  }
  
  const getScheduleStatus = (schedule: any) => {
    if (!schedule.next_due_date) return 'Not scheduled'
    
    const today = new Date()
    const dueDate = new Date(schedule.next_due_date)
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} days`
    if (diffDays === 0) return 'Due today'
    if (diffDays === 1) return 'Due tomorrow'
    if (diffDays < 7) return `Due in ${diffDays} days`
    if (diffDays < 30) return `Due in ${Math.floor(diffDays / 7)} weeks`
    return `Due in ${Math.floor(diffDays / 30)} months`
  }
  
  // Filter functions
  const filteredEquipment = equipment.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.model_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.unit_number?.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(item => 
    statusFilter === 'all' || item.status === statusFilter
  )
  
  const filteredTasks = maintenanceTasks.filter(task => 
    task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(task => 
    statusFilter === 'all' || (statusFilter === 'active' && task.is_active) || (statusFilter === 'inactive' && !task.is_active)
  )
  
  const filteredSchedules = maintenanceSchedules.filter(schedule => 
    schedule.equipment?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    schedule.task?.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(schedule => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'overdue') {
      const today = new Date()
      const dueDate = new Date(schedule.next_due_date)
      return dueDate < today
    }
    if (statusFilter === 'upcoming') {
      const today = new Date()
      const dueDate = new Date(schedule.next_due_date)
      const diffTime = dueDate.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays >= 0 && diffDays <= 7
    }
    if (statusFilter === 'completed') {
      return schedule.last_performed_date !== null
    }
    return true
  })
  
  const filteredLogs = maintenanceLogs.filter(log => 
    log.equipment?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.task?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(log => 
    statusFilter === 'all' || log.status === statusFilter
  )

  if (loading && equipment.length === 0 && maintenanceTasks.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">Preventative Maintenance</h1>
          <p className="text-gray-600">Manage equipment and maintenance schedules</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {[
            { id: 'equipment', label: 'Equipment', icon: Tool },
            { id: 'tasks', label: 'Maintenance Tasks', icon: Settings },
            { id: 'schedules', label: 'Schedules', icon: Calendar },
            { id: 'logs', label: 'Maintenance Logs', icon: FileText }
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Equipment Tab */}
      {activeTab === 'equipment' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search equipment..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="decommissioned">Decommissioned</option>
                </select>
                <button
                  onClick={() => {
                    resetEquipmentForm()
                    setEditingEquipment(null)
                    setShowEquipmentForm(true)
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Equipment
                </button>
              </div>
            </div>
          </div>

          {/* Equipment List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Equipment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEquipment.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        <div className="text-sm text-gray-500">{item.location || 'No location'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {item.model_number && <div>Model: {item.model_number}</div>}
                          {item.serial_number && <div>Serial: {item.serial_number}</div>}
                          {item.unit_number && <div>Unit #: {item.unit_number}</div>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {item.customer ? (
                            item.customer.customer_type === 'residential' ? 
                              `${item.customer.first_name} ${item.customer.last_name}` : 
                              item.customer.company_name
                          ) : 'No customer'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setEditingEquipment(item)
                            setEquipmentForm({
                              name: item.name,
                              model_number: item.model_number || '',
                              serial_number: item.serial_number || '',
                              unit_number: item.unit_number || '',
                              manufacturer: item.manufacturer || '',
                              installation_date: item.installation_date || '',
                              location: item.location || '',
                              status: item.status,
                              notes: item.notes || '',
                              customer_id: item.customer_id || ''
                            })
                            setShowEquipmentForm(true)
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteEquipment(item.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Equipment Form Modal */}
          {showEquipmentForm && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingEquipment ? 'Edit Equipment' : 'Add New Equipment'}
                    </h3>
                    <button
                      onClick={() => setShowEquipmentForm(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                
                <form onSubmit={handleEquipmentSubmit} className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={equipmentForm.name}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={equipmentForm.status}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="decommissioned">Decommissioned</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Model Number
                      </label>
                      <input
                        type="text"
                        value={equipmentForm.model_number}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, model_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Serial Number
                      </label>
                      <input
                        type="text"
                        value={equipmentForm.serial_number}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, serial_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unit Number
                      </label>
                      <input
                        type="text"
                        value={equipmentForm.unit_number}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, unit_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Manufacturer
                      </label>
                      <input
                        type="text"
                        value={equipmentForm.manufacturer}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, manufacturer: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Installation Date
                      </label>
                      <input
                        type="date"
                        value={equipmentForm.installation_date}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, installation_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location
                      </label>
                      <input
                        type="text"
                        value={equipmentForm.location}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Customer
                      </label>
                      <select
                        value={equipmentForm.customer_id}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, customer_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">No Customer</option>
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
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={equipmentForm.notes}
                      onChange={(e) => setEquipmentForm({ ...equipmentForm, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowEquipmentForm(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Saving...' : (editingEquipment ? 'Update' : 'Add')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Maintenance Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search maintenance tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <button
                  onClick={() => {
                    resetTaskForm()
                    setEditingTask(null)
                    setShowTaskForm(true)
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Task
                </button>
              </div>
            </div>
          </div>

          {/* Tasks List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{task.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{task.description || 'No description'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {Math.floor(task.estimated_duration_minutes / 60)}h {task.estimated_duration_minutes % 60}m
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${task.is_active ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                          {task.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setEditingTask(task)
                            setTaskForm({
                              name: task.name,
                              description: task.description || '',
                              estimated_duration_minutes: task.estimated_duration_minutes,
                              is_active: task.is_active
                            })
                            setShowTaskForm(true)
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Task Form Modal */}
          {showTaskForm && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingTask ? 'Edit Maintenance Task' : 'Add New Maintenance Task'}
                    </h3>
                    <button
                      onClick={() => setShowTaskForm(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                
                <form onSubmit={handleTaskSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Task Name *
                    </label>
                    <input
                      type="text"
                      value={taskForm.name}
                      onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={taskForm.description}
                      onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estimated Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={taskForm.estimated_duration_minutes}
                      onChange={(e) => setTaskForm({ ...taskForm, estimated_duration_minutes: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={taskForm.is_active}
                      onChange={(e) => setTaskForm({ ...taskForm, is_active: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                      Active Task
                    </label>
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowTaskForm(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Saving...' : (editingTask ? 'Update' : 'Add')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Maintenance Schedules Tab */}
      {activeTab === 'schedules' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search schedules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="overdue">Overdue</option>
                  <option value="upcoming">Due Soon</option>
                  <option value="completed">Completed</option>
                </select>
                <button
                  onClick={() => {
                    resetScheduleForm()
                    setEditingSchedule(null)
                    setShowScheduleForm(true)
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Schedule
                </button>
              </div>
            </div>
          </div>

          {/* Schedules List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Equipment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Frequency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Performed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Next Due
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSchedules.map((schedule) => (
                    <tr key={schedule.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{schedule.equipment?.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">{schedule.equipment?.location || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{schedule.task?.name || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 capitalize">{schedule.frequency}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {schedule.last_performed_date ? new Date(schedule.last_performed_date).toLocaleDateString() : 'Never'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {schedule.next_due_date ? new Date(schedule.next_due_date).toLocaleDateString() : 'Not scheduled'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getScheduleStatusColor(schedule)}`}>
                          {getScheduleStatus(schedule)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setEditingSchedule(schedule)
                            setScheduleForm({
                              equipment_id: schedule.equipment_id,
                              task_id: schedule.task_id,
                              frequency: schedule.frequency,
                              next_due_date: schedule.next_due_date || ''
                            })
                            setShowScheduleForm(true)
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteSchedule(schedule.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Schedule Form Modal */}
          {showScheduleForm && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingSchedule ? 'Edit Maintenance Schedule' : 'Add New Maintenance Schedule'}
                    </h3>
                    <button
                      onClick={() => setShowScheduleForm(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                
                <form onSubmit={handleScheduleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Equipment *
                    </label>
                    <select
                      value={scheduleForm.equipment_id}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, equipment_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Equipment</option>
                      {equipment.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} {item.unit_number ? `(${item.unit_number})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maintenance Task *
                    </label>
                    <select
                      value={scheduleForm.task_id}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, task_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Task</option>
                      {maintenanceTasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Frequency *
                    </label>
                    <select
                      value={scheduleForm.frequency}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="biannual">Bi-Annual</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Next Due Date
                    </label>
                    <input
                      type="date"
                      value={scheduleForm.next_due_date}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, next_due_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowScheduleForm(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Saving...' : (editingSchedule ? 'Update' : 'Add')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Maintenance Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search maintenance logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="incomplete">Incomplete</option>
                  <option value="needs_followup">Needs Follow-up</option>
                </select>
                <button
                  onClick={() => {
                    resetLogForm()
                    setEditingLog(null)
                    setShowLogForm(true)
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Log
                </button>
              </div>
            </div>
          </div>

          {/* Logs List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Equipment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Technician
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(log.performed_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{log.equipment?.name || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{log.task?.name || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {log.technician ? `${log.technician.first_name} ${log.technician.last_name}` : 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(log.status)}`}>
                          {log.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{log.notes || 'No notes'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setEditingLog(log)
                            setLogForm({
                              equipment_id: log.equipment_id,
                              task_id: log.task_id,
                              schedule_id: log.schedule_id || '',
                              performed_by: log.performed_by,
                              performed_date: log.performed_date,
                              notes: log.notes || '',
                              status: log.status
                            })
                            setShowLogForm(true)
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteLog(log.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Log Form Modal */}
          {showLogForm && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingLog ? 'Edit Maintenance Log' : 'Add New Maintenance Log'}
                    </h3>
                    <button
                      onClick={() => setShowLogForm(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                
                <form onSubmit={handleLogSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Equipment *
                    </label>
                    <select
                      value={logForm.equipment_id}
                      onChange={(e) => setLogForm({ ...logForm, equipment_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Equipment</option>
                      {equipment.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} {item.unit_number ? `(${item.unit_number})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maintenance Task *
                    </label>
                    <select
                      value={logForm.task_id}
                      onChange={(e) => setLogForm({ ...logForm, task_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Task</option>
                      {maintenanceTasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maintenance Schedule
                    </label>
                    <select
                      value={logForm.schedule_id}
                      onChange={(e) => setLogForm({ ...logForm, schedule_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">No Schedule</option>
                      {maintenanceSchedules
                        .filter(s => s.equipment_id === logForm.equipment_id && s.task_id === logForm.task_id)
                        .map((schedule) => (
                          <option key={schedule.id} value={schedule.id}>
                            {schedule.frequency} - Due: {schedule.next_due_date ? new Date(schedule.next_due_date).toLocaleDateString() : 'Not set'}
                          </option>
                        ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Performed By
                    </label>
                    <select
                      value={logForm.performed_by}
                      onChange={(e) => setLogForm({ ...logForm, performed_by: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Technician</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.first_name} {tech.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date Performed *
                    </label>
                    <input
                      type="date"
                      value={logForm.performed_date}
                      onChange={(e) => setLogForm({ ...logForm, performed_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status *
                    </label>
                    <select
                      value={logForm.status}
                      onChange={(e) => setLogForm({ ...logForm, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="completed">Completed</option>
                      <option value="incomplete">Incomplete</option>
                      <option value="needs_followup">Needs Follow-up</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={logForm.notes}
                      onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowLogForm(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Saving...' : (editingLog ? 'Update' : 'Add')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}