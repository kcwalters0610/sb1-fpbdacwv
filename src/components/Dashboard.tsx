import React, { useState, useEffect } from 'react'
import { 
  Users, 
  ClipboardList, 
  CheckCircle, 
  AlertTriangle,
  Package,
  TrendingUp,
  Calendar,
  Clock,
  User,
  Wrench,
  DollarSign,
  FileText
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { supabase, WorkOrder, Customer, Profile, InventoryItem } from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeWorkOrders: 0,
    totalInvoices: 0,
    monthlyRevenue: 0,
    completedOrders: 0,
    pendingOrders: 0,
    overdueInvoices: 0,
    cancelledOrders: 0
  })
  const [workOrderStatusData, setWorkOrderStatusData] = useState<any[]>([])
  const [workOrderPriorityData, setWorkOrderPriorityData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Sample data for charts
  const monthlyRevenueData = [
    { month: 'Feb', revenue: 0 },
    { month: 'Mar', revenue: 1 },
    { month: 'Apr', revenue: 2 },
    { month: 'May', revenue: 1.5 },
    { month: 'Jun', revenue: 3 },
    { month: 'Jul', revenue: 4 }
  ]


  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
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

      // Load customers count
      const { count: customersCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)

      // Load work orders stats
      const { count: totalOrders } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)

      const { count: activeOrders } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .in('status', ['open', 'scheduled', 'in_progress'])

      const { count: completedOrders } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('status', 'completed')

      const { count: pendingOrders } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('status', 'scheduled')

      const { count: cancelledOrders } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('status', 'cancelled')

      const { count: inProgressOrders } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('status', 'in_progress')

      // Load invoices count
      const { count: invoicesCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)

      const { count: overdueInvoices } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('status', 'overdue')

      // Load work order priority counts
      const { count: urgentOrders } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('priority', 'urgent')

      const { count: highOrders } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('priority', 'high')

      const { count: mediumOrders } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('priority', 'medium')

      const { count: lowOrders } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('priority', 'low')

      setStats({
        totalCustomers: customersCount || 0,
        activeWorkOrders: activeOrders || 0,
        totalInvoices: invoicesCount || 0,
        monthlyRevenue: 0, // Would calculate from actual invoice data
        completedOrders: completedOrders || 0,
        pendingOrders: pendingOrders || 0,
        overdueInvoices: overdueInvoices || 0,
        cancelledOrders: cancelledOrders || 0
      })

      // Set work order status data
      const statusData = [
        { name: 'Completed', value: completedOrders || 0, color: '#10B981' },
        { name: 'In Progress', value: inProgressOrders || 0, color: '#3B82F6' },
        { name: 'Scheduled', value: pendingOrders || 0, color: '#F59E0B' },
        { name: 'Cancelled', value: cancelledOrders || 0, color: '#EF4444' }
      ].filter(item => item.value > 0)

      setWorkOrderStatusData(statusData)

      // Set work order priority data
      const priorityData = [
        { name: 'Urgent', value: urgentOrders || 0, color: '#EF4444' },
        { name: 'High', value: highOrders || 0, color: '#F97316' },
        { name: 'Medium', value: mediumOrders || 0, color: '#F59E0B' },
        { name: 'Low', value: lowOrders || 0, color: '#10B981' }
      ].filter(item => item.value > 0)

      setWorkOrderPriorityData(priorityData)

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
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
      {/* Top Stats Row - Enhanced with hover effects */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover-card-effect">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Customers</p>
              <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400">{stats.totalCustomers}</p>
              <p className="text-sm text-gray-500 mt-1">Active accounts</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full shadow-sm">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover-card-effect">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Work Orders</p>
              <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400">{stats.activeWorkOrders}</p>
              <p className="text-sm text-gray-500 mt-1">In progress or scheduled</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full shadow-sm">
              <ClipboardList className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover-card-effect">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Invoices</p>
              <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400">{stats.totalInvoices}</p>
              <p className="text-sm text-gray-500 mt-1">All invoices</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full shadow-sm">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover-card-effect">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
              <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-green-400">${stats.monthlyRevenue}</p>
              <p className="text-sm text-gray-500 mt-1">Current month</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full shadow-sm">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Status Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-md p-6 text-white hover-card-effect">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-teal-100 text-sm font-medium">Completed Orders</p>
              <p className="text-4xl font-bold">{stats.completedOrders}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-teal-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md p-6 text-white hover-card-effect">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Pending Orders</p>
              <p className="text-4xl font-bold">{stats.pendingOrders}</p>
            </div>
            <Calendar className="w-12 h-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-md p-6 text-white hover-card-effect">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Overdue Invoices</p>
              <p className="text-4xl font-bold">{stats.overdueInvoices}</p>
            </div>
            <AlertTriangle className="w-12 h-12 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl shadow-md p-6 text-white hover-card-effect">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-teal-100 text-sm font-medium">Cancelled Orders</p>
              <p className="text-4xl font-bold">{stats.cancelledOrders}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-teal-200" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: "0.4s" }}>
        {/* Monthly Revenue Chart - Enhanced with better shadows and hover effect */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Monthly Revenue</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  domain={[0, 'dataMax']}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#06b6d4" 
                  strokeWidth={3}
                  dot={{ fill: '#06b6d4', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#0891b2' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Work Order Status Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Work Order Status Distribution</h3>
          {workOrderStatusData.length > 0 ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={workOrderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {workOrderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {workOrderStatusData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm text-gray-600">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No work order data available
            </div>
          )}
        </div>

        {/* Work Order Priority Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Work Order Priority Distribution</h3>
          {workOrderPriorityData.length > 0 ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={workOrderPriorityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {workOrderPriorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {workOrderPriorityData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm text-gray-600">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No priority data available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}