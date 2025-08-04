import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Clock, User, Calendar, Filter, Edit2, Trash2, CheckCircle, XCircle, TrendingUp, Zap, Sparkles } from 'lucide-react'

interface TimeEntry {
  id: string
  user_id: string
  company_id: string
  work_order_id?: string
  project_id?: string
  start_time: string
  end_time?: string
  duration_minutes: number
  description: string
  status: 'pending' | 'approved' | 'rejected'
  entry_type: 'work' | 'pto' | 'sick' | 'holiday'
  created_at: string
  updated_at: string
  user?: {
    first_name: string
    last_name: string
    role: string
  }
  work_order?: {
    wo_number: string
    title: string
  }
  project?: {
    project_name: string
  }
}

interface WorkOrder {
  id: string
  wo_number: string
  title: string
}

interface Project {
  id: string
  project_name: string
}

interface Department {
  id: string
  name: string
}

export default function TimeCards() {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('timecards')
  const [reportData, setReportData] = useState<any[]>([])
  const [reportDateRange, setReportDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })

  const [formData, setFormData] = useState({
    work_order_id: '',
    project_id: '',
    start_time: '',
    end_time: '',
    duration_minutes: 0,
    description: '',
    entry_type: 'work' as 'work' | 'pto' | 'sick' | 'holiday'
  })

  useEffect(() => {
    getCurrentUser()
    loadUsers()
    loadWorkOrders()
    loadProjects()
    loadDepartments()
  }, [])

  useEffect(() => {
    loadTimeEntries()
  }, [selectedUser, selectedWeek, statusFilter])

  useEffect(() => {
    if (activeTab === 'reports' && currentUser?.profile?.role === 'admin') {
      loadTimeReports()
    }
  }, [activeTab, reportDateRange])

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

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('first_name')

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const loadWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('id, wo_number, title')
        .eq('status', 'in_progress')
        .order('wo_number')

      if (error) throw error
      setWorkOrders(data || [])
    } catch (error) {
      console.error('Error loading work orders:', error)
    }
  }

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name')
        .in('status', ['planning', 'in_progress'])
        .order('project_name')

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setDepartments(data || [])
    } catch (error) {
      console.error('Error loading departments:', error)
    }
  }

  const loadTimeEntries = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('time_entries')
        .select(`
          *,
          user:profiles(first_name, last_name, role),
          work_order:work_orders(wo_number, title),
          project:projects(project_name)
        `)
        .order('start_time', { ascending: false })

      if (selectedUser) {
        query = query.eq('user_id', selectedUser)
      }

      if (selectedWeek) {
        const startOfWeek = new Date(selectedWeek)
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        
        query = query
          .gte('start_time', startOfWeek.toISOString())
          .lte('start_time', endOfWeek.toISOString())
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query

      if (error) throw error
      setTimeEntries(data || [])
    } catch (error) {
      console.error('Error loading time entries:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTimeReports = async () => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          user:profiles(first_name, last_name, role),
          work_order:work_orders(wo_number, title),
          project:projects(project_name)
        `)
        .gte('start_time', reportDateRange.startDate + 'T00:00:00')
        .lte('start_time', reportDateRange.endDate + 'T23:59:59')
        .order('start_time', { ascending: false })

      if (error) throw error
      setReportData(data || [])
    } catch (error) {
      console.error('Error loading time reports:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
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
        work_order_id: formData.work_order_id || null,
        project_id: formData.project_id || null,
        start_time: formData.start_time,
        end_time: formData.end_time || null,
        duration_minutes: formData.duration_minutes,
        description: formData.description,
        entry_type: formData.entry_type,
        status: 'pending'
      }

      if (editingEntry) {
        const { error } = await supabase
          .from('time_entries')
          .update(entryData)
          .eq('id', editingEntry.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('time_entries')
          .insert([entryData])

        if (error) throw error
      }

      setShowForm(false)
      resetForm()
      loadTimeEntries()
    } catch (error) {
      console.error('Error saving time entry:', error)
      alert('Error saving time entry. Please try again.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this time entry?')) return

    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadTimeEntries()
    } catch (error) {
      console.error('Error deleting time entry:', error)
      alert('Error deleting time entry. Please try again.')
    }
  }

  const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('time_entries')
        .update({ status })
        .eq('id', id)

      if (error) throw error
      loadTimeEntries()
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Error updating status. Please try again.')
    }
  }

  const resetForm = () => {
    setFormData({
      work_order_id: '',
      project_id: '',
      start_time: '',
      end_time: '',
      duration_minutes: 0,
      description: '',
      entry_type: 'work'
    })
    setEditingEntry(null)
  }

  const editEntry = (entry: TimeEntry) => {
    setFormData({
      work_order_id: entry.work_order_id || '',
      project_id: entry.project_id || '',
      start_time: entry.start_time.slice(0, 16),
      end_time: entry.end_time ? entry.end_time.slice(0, 16) : '',
      duration_minutes: entry.duration_minutes,
      description: entry.description,
      entry_type: entry.entry_type
    })
    setEditingEntry(entry)
    setShowForm(true)
  }

  const calculateDuration = () => {
    if (formData.start_time && formData.end_time) {
      const start = new Date(formData.start_time)
      const end = new Date(formData.end_time)
      const diffMs = end.getTime() - start.getTime()
      const diffMins = Math.round(diffMs / (1000 * 60))
      setFormData({ ...formData, duration_minutes: diffMins })
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getEntryTypeColor = (type: string) => {
    switch (type) {
      case 'work': return 'bg-blue-100 text-blue-800'
      case 'pto': return 'bg-purple-100 text-purple-800'
      case 'sick': return 'bg-red-100 text-red-800'
      case 'holiday': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Calculate stats
  const totalHours = timeEntries.reduce((sum, entry) => sum + entry.duration_minutes, 0)
  const approvedHours = timeEntries.filter(e => e.status === 'approved').reduce((sum, entry) => sum + entry.duration_minutes, 0)

  // Calculate regular and overtime hours
  const calculateTimeBreakdown = (entries: TimeEntry[]) => {
    const breakdown = entries.reduce((acc, entry) => {
      const hours = entry.duration_minutes / 60
      const date = new Date(entry.start_time).toDateString()
      
      if (!acc[entry.user_id]) {
        acc[entry.user_id] = {}
      }
      
      if (!acc[entry.user_id][date]) {
        acc[entry.user_id][date] = { regular: 0, overtime: 0 }
      }
      
      const dailyTotal = acc[entry.user_id][date].regular + acc[entry.user_id][date].overtime + hours
      
      if (dailyTotal <= 8) {
        acc[entry.user_id][date].regular += hours
      } else if (acc[entry.user_id][date].regular < 8) {
        const regularHours = 8 - acc[entry.user_id][date].regular
        const overtimeHours = hours - regularHours
        acc[entry.user_id][date].regular += regularHours
        acc[entry.user_id][date].overtime += overtimeHours
      } else {
        acc[entry.user_id][date].overtime += hours
      }
      
      return acc
    }, {} as Record<string, Record<string, { regular: number; overtime: number }>>)
    
    return breakdown
  }

  const timeBreakdown = calculateTimeBreakdown(timeEntries.filter(e => e.status === 'approved'))
  
  const totalRegularHours = Object.values(timeBreakdown).reduce((total, userDays) => {
    return total + Object.values(userDays).reduce((userTotal, day) => userTotal + day.regular, 0)
  }, 0)
  
  const totalOvertimeHours = Object.values(timeBreakdown).reduce((total, userDays) => {
    return total + Object.values(userDays).reduce((userTotal, day) => userTotal + day.overtime, 0)
  }, 0)

  // Report calculations
  const reportTotalHours = reportData.reduce((sum, entry) => sum + entry.duration_minutes, 0)
  const reportByUser = reportData.reduce((acc, entry) => {
    const userName = `${entry.user?.first_name} ${entry.user?.last_name}`
    if (!acc[userName]) {
      acc[userName] = { hours: 0, entries: 0 }
    }
    acc[userName].hours += entry.duration_minutes
    acc[userName].entries += 1
    return acc
  }, {} as Record<string, { hours: number; entries: number }>)

  if (loading && timeEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {activeTab === 'timecards' && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Time Cards</h1>
            <p className="text-gray-600">Track and manage employee time entries</p>
          </div>
          <div className="flex space-x-3">
            {currentUser?.profile?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('reports')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors"
              >
                Time Reports
              </button>
            )}
            <button
              onClick={() => {
                resetForm()
                setEditingEntry(null)
                setShowForm(true)
              }}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Time Entry
            </button>
          </div>
        </div>
      )}

      {activeTab === 'reports' && currentUser?.profile?.role === 'admin' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Time Reports</h1>
              <p className="text-gray-600">Comprehensive time tracking reports and analytics</p>
            </div>
            <button
              onClick={() => setActiveTab('timecards')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to Time Cards
            </button>
          </div>

          {/* Report Date Range */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Period</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={reportDateRange.startDate}
                  onChange={(e) => setReportDateRange({ ...reportDateRange, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={reportDateRange.endDate}
                  onChange={(e) => setReportDateRange({ ...reportDateRange, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Report Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <Clock className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Hours</p>
                  <p className="text-2xl font-bold text-gray-900">{formatDuration(reportTotalHours)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <User className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">{Object.keys(reportByUser).length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Entries</p>
                  <p className="text-2xl font-bold text-gray-900">{reportData.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Hours by Employee */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Hours by Employee</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entries
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Hours/Entry
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(reportByUser).map(([userName, data]) => (
                    <tr key={userName} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {userName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(data.hours)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {data.entries}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(Math.round(data.hours / data.entries))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Time Entries */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Detailed Time Entries</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {entry.user?.first_name} {entry.user?.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{entry.user?.role}</div>
                      </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(entry.start_time).toLocaleDateString()}
                      </div>
                        <div className="text-sm text-gray-500">
                          {new Date(entry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                          {entry.end_time && new Date(entry.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatDuration(entry.duration_minutes)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEntryTypeColor(entry.entry_type)}`}>
                          {entry.entry_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{entry.description}</div>
                        {entry.work_order && (
                          <div className="text-sm text-gray-500">WO: {entry.work_order.wo_number}</div>
                        )}
                        {entry.project && (
                          <div className="text-sm text-gray-500">Project: {entry.project.project_name}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(entry.status)}`}>
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {activeTab === 'timecards' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by User
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Users</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Week
              </label>
              <input
                type="week"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedUser('')
                  setSelectedWeek('')
                  setStatusFilter('')
                }}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {activeTab === 'timecards' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Hours</p>
                <p className="text-2xl font-bold text-gray-900">{formatDuration(totalHours)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Regular Hours</p>
                <p className="text-2xl font-bold text-gray-900">{totalRegularHours.toFixed(1)}h</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overtime Hours</p>
                <p className="text-2xl font-bold text-gray-900">{totalOvertimeHours.toFixed(1)}h</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Approved Hours</p>
                <p className="text-2xl font-bold text-gray-900">{formatDuration(approvedHours)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Entries</p>
                <p className="text-2xl font-bold text-gray-900">{timeEntries.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Entries Table */}
      {activeTab === 'timecards' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Time Entries</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time Type
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
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
                {timeEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {entry.user?.first_name} {entry.user?.last_name}
                      </div>
                      <div className="text-sm text-gray-500">{entry.user?.role}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(entry.start_time).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(entry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                        {entry.end_time && new Date(entry.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatDuration(entry.duration_minutes)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(() => {
                          const userId = entry.user_id
                          const date = new Date(entry.start_time).toDateString()
                          const userBreakdown = timeBreakdown[userId]?.[date]
                          const hours = entry.duration_minutes / 60
                          
                          if (!userBreakdown) return 'Regular'
                          
                          // Calculate if this entry would be overtime
                          const existingRegular = userBreakdown.regular
                          const existingOvertime = userBreakdown.overtime
                          const totalExisting = existingRegular + existingOvertime
                          
                          if (totalExisting <= 8) {
                            return 'Regular'
                          } else if (existingRegular < 8) {
                            return 'Mixed'
                          } else {
                            return 'Overtime'
                          }
                        })()}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const userId = entry.user_id
                        const date = new Date(entry.start_time).toDateString()
                        const userBreakdown = timeBreakdown[userId]?.[date]
                        const hours = entry.duration_minutes / 60
                        
                        if (!userBreakdown) {
                          return (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Regular
                            </span>
                          )
                        }
                        
                        const existingRegular = userBreakdown.regular
                        const existingOvertime = userBreakdown.overtime
                        const totalExisting = existingRegular + existingOvertime
                        
                        if (totalExisting <= 8) {
                          return (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Regular
                            </span>
                          )
                        } else if (existingRegular < 8) {
                          const regularPortion = 8 - existingRegular
                          const overtimePortion = hours - regularPortion
                          return (
                            <div className="space-y-1">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                {regularPortion.toFixed(1)}h Regular
                              </span>
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                                {overtimePortion.toFixed(1)}h Overtime
                              </span>
                            </div>
                          )
                        } else {
                          return (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                              Overtime
                            </span>
                          )
                        }
                      })()}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEntryTypeColor(entry.entry_type)}`}>
                        {entry.entry_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4">
                      <div className="text-sm text-gray-900">{entry.description}</div>
                      {entry.work_order && (
                        <div className="text-sm text-gray-500">WO: {entry.work_order.wo_number}</div>
                      )}
                      {entry.project && (
                        <div className="text-sm text-gray-500">Project: {entry.project.project_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(entry.status)}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {(currentUser?.profile?.role === 'admin' || currentUser?.profile?.role === 'manager') && entry.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => handleStatusUpdate(entry.id, 'approved')} 
                              className="text-green-600 hover:text-green-800 p-1.5 transition-all duration-200 hover:bg-green-100 rounded-full hover:shadow-sm transform hover:scale-110" 
                              title="Approve" 
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleStatusUpdate(entry.id, 'rejected')} 
                              className="text-red-600 hover:text-red-800 p-1.5 transition-all duration-200 hover:bg-red-100 rounded-full hover:shadow-sm transform hover:scale-110" 
                              title="Reject" 
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {(entry.user_id === currentUser?.id && entry.status === 'pending') && (
                          <button
                            onClick={() => editEntry(entry)}
                            className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {(currentUser?.profile?.role === 'admin' || entry.user_id === currentUser?.id) && entry.status === 'pending' && (
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="text-red-600 hover:text-red-800 p-1.5 transition-all duration-200 hover:bg-red-100 rounded-full hover:shadow-sm transform hover:scale-110"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingEntry ? 'Edit Time Entry' : 'Add Time Entry'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Entry Type
                </label>
                <select
                  value={formData.entry_type}
                  onChange={(e) => setFormData({ ...formData, entry_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="work">Work</option>
                  <option value="pto">PTO</option>
                  <option value="sick">Sick Leave</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>

              {formData.entry_type === 'work' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Work Order (Optional)
                    </label>
                    <select
                      value={formData.work_order_id}
                      onChange={(e) => setFormData({ ...formData, work_order_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Work Order</option>
                      {workOrders.map((wo) => (
                        <option key={wo.id} value={wo.id}>
                          {wo.wo_number} - {wo.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Project (Optional)
                    </label>
                    <select
                      value={formData.project_id}
                      onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.project_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  onBlur={calculateDuration}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  required
                  placeholder="Describe the work performed or reason for time off..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingEntry ? 'Update Entry' : 'Add Entry'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}