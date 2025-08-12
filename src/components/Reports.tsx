import React, { useState, useEffect } from 'react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer, 
  Tooltip, 
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  FileText, 
  Download, 
  Calendar, 
  Filter, 
  DollarSign, 
  Users, 
  Clock, 
  CheckCircle,
  Wrench,
  Building2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function Reports() {
  const [activeTab, setActiveTab] = useState('workOrders')
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  })
  const [loading, setLoading] = useState(true)
  const [companyInfo, setCompanyInfo] = useState<any>(null)
  
  // Data states
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [timeEntries, setTimeEntries] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])

  useEffect(() => {
    loadCompanyInfo()
    getCurrentUser();
    loadReportData()
  }, [dateRange])

  const loadCompanyInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile) return

      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single()

      setCompanyInfo(company)
    } catch (error) {
      console.error('Error loading company info:', error)
    }
  }

  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setCurrentUser({ ...user, profile });
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const loadReportData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile) return

      // Load work orders
      const { data: workOrdersData } = await supabase
        .from('work_orders')
        .select(`
          *,
          customer:customers(*),
          assigned_technician:profiles!work_orders_assigned_to_fkey(*)
        `)
        .eq('company_id', profile.company_id)
        .gte('created_at', dateRange.startDate + 'T00:00:00')
        .lte('created_at', dateRange.endDate + 'T23:59:59')
        .order('created_at', { ascending: false })

      setWorkOrders(workOrdersData || [])

      // Load invoices
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('company_id', profile.company_id)
        .gte('issue_date', dateRange.startDate + 'T00:00:00')
        .lte('issue_date', dateRange.endDate + 'T23:59:59')
        .order('issue_date', { ascending: false })

      setInvoices(invoicesData || [])

      // Load time entries
      const { data: timeEntriesData } = await supabase
        .from('time_entries')
        .select(`
          *,
          user:profiles(*),
          work_order:work_orders(*)
        `)
        .eq('company_id', profile.company_id)
        .gte('start_time', dateRange.startDate + 'T00:00:00')
        .lte('start_time', dateRange.endDate + 'T23:59:59')
        .order('start_time', { ascending: false })

      setTimeEntries(timeEntriesData || [])

      // Load technicians
      const { data: techniciansData } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('role', 'tech')
        .eq('is_active', true)

      setTechnicians(techniciansData || [])

      // Load customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(100)

      setCustomers(customersData || [])
    } catch (error) {
      console.error('Error loading report data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate report metrics
  const calculateWorkOrderMetrics = () => {
    const total = workOrders.length
    const completed = workOrders.filter(wo => wo.status === 'completed').length
    const inProgress = workOrders.filter(wo => wo.status === 'in_progress').length
    const scheduled = workOrders.filter(wo => wo.status === 'scheduled').length
    const cancelled = workOrders.filter(wo => wo.status === 'cancelled').length
    
    const statusData = [
      { name: 'Completed', value: completed, color: '#10B981' },
      { name: 'In Progress', value: inProgress, color: '#3B82F6' },
      { name: 'Scheduled', value: scheduled, color: '#F59E0B' },
      { name: 'Cancelled', value: cancelled, color: '#EF4444' }
    ]

    const priorityData = [
      { name: 'Low', value: workOrders.filter(wo => wo.priority === 'low').length, color: '#10B981' },
      { name: 'Medium', value: workOrders.filter(wo => wo.priority === 'medium').length, color: '#F59E0B' },
      { name: 'High', value: workOrders.filter(wo => wo.priority === 'high').length, color: '#F97316' },
      { name: 'Urgent', value: workOrders.filter(wo => wo.priority === 'urgent').length, color: '#EF4444' }
    ]

    return {
      total,
      completed,
      inProgress,
      scheduled,
      cancelled,
      statusData,
      priorityData
    }
  }

  const calculateFinancialMetrics = () => {
    const totalRevenue = invoices.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0)
    const paidInvoices = invoices.filter(inv => inv.status === 'paid')
    const paidAmount = paidInvoices.reduce((sum, invoice) => sum + (invoice.paid_amount || 0), 0)
    const outstandingAmount = totalRevenue - paidAmount
    
    const monthlyData = []
    const today = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(today, i)
      const monthName = format(month, 'MMM')
      const monthStart = format(startOfMonth(month), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd')
      
      const monthInvoices = invoices.filter(inv => 
        inv.issue_date >= monthStart && inv.issue_date <= monthEnd
      )
      
      const revenue = monthInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
      
      monthlyData.push({
        name: monthName,
        revenue: revenue
      })
    }

    return {
      totalRevenue,
      paidAmount,
      outstandingAmount,
      averageInvoiceValue: invoices.length > 0 ? totalRevenue / invoices.length : 0,
      monthlyData
    }
  }

  const calculateTechnicianMetrics = () => {
    const techData = technicians.map(tech => {
      const techEntries = timeEntries.filter(entry => entry.user_id === tech.id)
      const totalMinutes = techEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0)
      const totalHours = totalMinutes / 60
      const completedJobs = workOrders.filter(wo => wo.assigned_to === tech.id && wo.status === 'completed').length
      
      return {
        id: tech.id,
        name: `${tech.first_name} ${tech.last_name}`,
        hours: totalHours,
        jobs: completedJobs,
        efficiency: completedJobs > 0 ? totalHours / completedJobs : 0
      }
    })
    
    // Sort by hours worked
    techData.sort((a, b) => b.hours - a.hours)
    
    return {
      techData,
      totalTechs: technicians.length,
      totalHours: techData.reduce((sum, tech) => sum + tech.hours, 0),
      averageHoursPerTech: technicians.length > 0 ? 
        techData.reduce((sum, tech) => sum + tech.hours, 0) / technicians.length : 0
    }
  }

  const calculateCustomerMetrics = () => {
    const totalCustomers = customers.length
    const newCustomersThisMonth = customers.filter(customer => {
      const createdDate = new Date(customer.created_at)
      return createdDate >= new Date(dateRange.startDate) && createdDate <= new Date(dateRange.endDate)
    }).length
    
    const customerTypeData = [
      { name: 'Residential', value: customers.filter(c => c.customer_type === 'residential').length, color: '#3B82F6' },
      { name: 'Commercial', value: customers.filter(c => c.customer_type === 'commercial').length, color: '#10B981' }
    ]
    
    return {
      totalCustomers,
      newCustomersThisMonth,
      customerTypeData
    }
  }

  // Helper functions for PDF generation
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString()
  }

  const getReportTitle = () => {
    switch (activeTab) {
      case 'workOrders':
        return 'Work Orders Report'
      case 'financial':
        return 'Financial Report'
      case 'technicians':
        return 'Technicians Report'
      case 'customers':
        return 'Customers Report'
      default:
        return 'Report'
    }
  }

  const getTableColumns = () => {
    switch (activeTab) {
      case 'workOrders':
        return ['WO Number', 'Customer', 'Status', 'Priority', 'Created Date']
      case 'financial':
        return ['Invoice Number', 'Customer', 'Amount', 'Status', 'Issue Date']
      case 'technicians':
        return ['Name', 'Hours Worked', 'Jobs Completed', 'Efficiency']
      case 'customers':
        return ['Name', 'Type', 'Email', 'Phone', 'Created Date']
      default:
        return []
    }
  }

  const getTableData = () => {
    switch (activeTab) {
      case 'workOrders':
        return workOrders.map(wo => [
          wo.wo_number,
          wo.customer ? `${wo.customer.first_name} ${wo.customer.last_name}` : 'N/A',
          wo.status,
          wo.priority,
          formatDate(wo.created_at)
        ])
      case 'financial':
        return invoices.map(inv => [
          inv.invoice_number,
          inv.customer ? `${inv.customer.first_name} ${inv.customer.last_name}` : 'N/A',
          `$${inv.total_amount?.toFixed(2) || '0.00'}`,
          inv.status,
          formatDate(inv.issue_date)
        ])
      case 'technicians':
        const techMetrics = calculateTechnicianMetrics()
        return techMetrics.techData.map(tech => [
          tech.name,
          tech.hours.toFixed(1),
          tech.jobs.toString(),
          tech.efficiency.toFixed(2)
        ])
      case 'customers':
        return customers.map(customer => [
          `${customer.first_name} ${customer.last_name}`,
          customer.customer_type,
          customer.email || 'N/A',
          customer.phone || 'N/A',
          formatDate(customer.created_at)
        ])
      default:
        return []
    }
  }

  // Report rendering functions
  const renderWorkOrderReport = () => {
    const metrics = calculateWorkOrderMetrics()
    
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Work Orders</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.total}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.completed}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.inProgress}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wrench className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Scheduled</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.scheduled}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics.statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {metrics.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics.priorityData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {metrics.priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )
  }

  const renderFinancialReport = () => {
    const metrics = calculateFinancialMetrics()
    
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">${metrics.totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Paid Amount</p>
                <p className="text-2xl font-bold text-gray-900">${metrics.paidAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Outstanding</p>
                <p className="text-2xl font-bold text-gray-900">${metrics.outstandingAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Invoice</p>
                <p className="text-2xl font-bold text-gray-900">${metrics.averageInvoiceValue.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={metrics.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
              <Legend />
              <Bar dataKey="revenue" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  const renderTechnicianReport = () => {
    const metrics = calculateTechnicianMetrics()
    
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Technicians</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.totalTechs}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Hours</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.totalHours.toFixed(1)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Wrench className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Hours/Tech</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.averageHoursPerTech.toFixed(1)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Technician Performance Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Technician Performance</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={metrics.techData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="hours" fill="#3B82F6" name="Hours Worked" />
              <Bar dataKey="jobs" fill="#10B981" name="Jobs Completed" />
            </BarChart>
          </ResponsiveContainer>
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
                    Technician
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Work Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {timeEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {entry.user ? `${entry.user.first_name} ${entry.user.last_name}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.work_order?.wo_number || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(entry.start_time)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {Math.round((entry.duration_minutes || 0) / 60 * 10) / 10}h
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {entry.description || 'No description'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  const renderCustomerReport = () => {
    const metrics = calculateCustomerMetrics()
    
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.totalCustomers}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">New This Period</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.newCustomersThisMonth}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Type Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Type Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={metrics.customerTypeData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {metrics.customerTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  // Export to PDF
  const exportReportPDF = async () => {
    try {
      console.log("Starting PDF export");
      // Initialize PDF with better settings for professional reports
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      // Helper function to load image asynchronously
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
          img.src = src;
        });
      };
      
      // Get company settings
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('id', currentUser?.profile?.company_id)
        .single();
      
      console.log("Company data:", data);
      
      // Add company name
      doc.setFontSize(22);
      doc.setTextColor(0, 68, 108);
      doc.text(data?.name || 'Company Report', doc.internal.pageSize.width / 2, 25, { align: 'center' });
      
      // Try to load logo image
      if (data?.settings?.logo_url && data.settings.logo_url.length > 5) {
        console.log("Attempting to load logo from:", data.settings.logo_url);
        try {
          // Create a new Image object
          const img = new Image();
          
          // Set up a promise to handle the image loading
          await new Promise((resolve, reject) => {
            img.onload = () => {
              console.log("Logo loaded successfully, dimensions:", img.width, "x", img.height);
              try {
                // Create a canvas to convert the image
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw the image on the canvas
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0);
                  
                  // Get the data URL
                  const dataURL = canvas.toDataURL('image/png');
                  
                  // Calculate aspect ratio to maintain proportions
                  const aspectRatio = img.width / img.height;
                  const logoHeight = 15;
                  const logoWidth = logoHeight * aspectRatio;
                  
                  // Add the image to the PDF
                  doc.addImage(dataURL, 'PNG', 20, 15, logoWidth, logoHeight);
                  console.log("Logo added to PDF successfully");
                }
                resolve(true);
              } catch (err) {
                console.error("Error processing logo:", err);
                reject(err);
              }
            };
            
            img.onerror = (err) => {
              console.error("Error loading logo:", err);
              reject(err);
            };
            
            // Set crossOrigin to anonymous to handle CORS issues
            img.crossOrigin = "Anonymous";
            img.src = data.settings.logo_url;
          });
        } catch (error) {
          console.error('Failed to load company logo:', error);
          }
      }
      
      // Continue with PDF generation
      const reportTitle = getReportTitle();
      
      // Add report title with better formatting
      doc.setFontSize(18);
      doc.setTextColor(51, 51, 51); // Dark gray for better readability
      doc.text(reportTitle, 20, 50);
      
      // Add date range
      doc.setFontSize(12);
      doc.setTextColor(102, 102, 102); // Medium gray for secondary text
      doc.text(`Report Period: ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}`, 20, 60);
      
      // Add table with better styling
      const tableColumn = getTableColumns();
      const tableRows = getTableData();
      
      doc.autoTable({
        startY: 70,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { 
          fillColor: [0, 68, 108], // Professional blue header
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: {
          fillColor: [240, 245, 255] // Light blue for alternate rows
        },
        styles: { 
          fontSize: 10,
          cellPadding: 5,
          lineWidth: 0.1,
          lineColor: [220, 220, 220]
        }
      });
      
      // Add summary at the bottom
      const finalY = (doc as any).lastAutoTable.finalY || 70;
      
      // Add footer with company info and generation details
      doc.setFontSize(10);
      doc.setTextColor(102, 102, 102);
      doc.text(`Total Records: ${tableRows.length}`, 20, finalY + 15);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, finalY + 22);
      
      // Add page numbers
      const pageCount = (doc as any).internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
      }
      
      // Save the PDF
      const fileName = `${reportTitle.replace(/\s+/g, '_')}_${formatDate(new Date())}.pdf`;
      doc.save(fileName);
      console.log("PDF generated and saved successfully");
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF report. Please try again.');
    }
  }

  // Render report content based on active tab
  const renderReportContent = () => {
    switch (activeTab) {
      case 'workOrders':
        return renderWorkOrderReport();
      case 'financial':
        return renderFinancialReport();
      case 'technicians':
        return renderTechnicianReport();
      case 'customers':
        return renderCustomerReport();
      default:
        return renderWorkOrderReport();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Generate insights and export reports</p>
        </div>
        <button
          onClick={exportReportPDF}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-5 h-5 mr-2" />
          Export PDF
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center">
            <Filter className="w-5 h-5 text-gray-400 mr-2" />
            <span className="text-sm font-medium text-gray-700">Report Type:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'workOrders', label: 'Work Orders', icon: FileText },
              { id: 'financial', label: 'Financial', icon: DollarSign },
              { id: 'technicians', label: 'Technicians', icon: Users },
              { id: 'customers', label: 'Customers', icon: Building2 }
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              )
            })}
          </div>
          <div className="md:ml-auto flex flex-col sm:flex-row gap-2">
            <div className="flex items-center">
              <Calendar className="w-5 h-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-700">Date Range:</span>
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <span className="self-center text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        renderReportContent()
      )}
    </div>
  )
}