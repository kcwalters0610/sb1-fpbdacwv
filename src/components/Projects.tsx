import React, { useState, useEffect } from 'react'
import { Plus, Search, Calendar, User, DollarSign, Edit, Trash2, Eye, X, Building2, Target, Clock, CheckCircle, ArrowRight } from 'lucide-react'
import { supabase, Project, Customer, Profile, Estimate, CustomerSite } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'
import { getNextNumber, updateNextNumber } from '../lib/numbering'

interface ProjectsProps {
  selectedRecordId?: string | null
  onRecordViewed?: () => void
}

export default function Projects({ selectedRecordId, onRecordViewed }: ProjectsProps = {}) {
  const { viewType, setViewType } = useViewPreference('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [managers, setManagers] = useState<Profile[]>([])
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [customerSites, setCustomerSites] = useState<CustomerSite[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [loadingSites, setLoadingSites] = useState(false)

  const [formData, setFormData] = useState({
    project_number: '',
    project_name: '',
    description: '',
    customer_id: '',
    customer_site_id: '',
    project_manager: '',
    start_date: '',
    estimated_end_date: '',
    total_budget: '',
    status: 'planning',
    priority: 'medium',
    notes: '',
    estimate_id: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // Auto-open detail modal if selectedRecordId is provided
    if (selectedRecordId && projects.length > 0) {
      const project = projects.find(proj => proj.id === selectedRecordId)
      if (project) {
        setSelectedProject(project)
        onRecordViewed?.()
      }
    }
  }, [selectedRecordId, projects, onRecordViewed])

  useEffect(() => {
    // Generate project number when form opens
    if (showForm && !editingProject) {
      generateProjectNumber()
    }
  }, [showForm, editingProject])

  useEffect(() => {
    // Load customer sites when customer changes
    if (formData.customer_id) {
      loadCustomerSites(formData.customer_id)
    } else {
      setCustomerSites([])
      setFormData(prev => ({ ...prev, customer_site_id: '' }))
    }
  }, [formData.customer_id])

  const generateProjectNumber = async () => {
    try {
      const { formattedNumber: projectNumber } = await getNextNumber('project')
      setFormData(prev => ({ ...prev, project_number: projectNumber }))
    } catch (error) {
      console.error('Error generating project number:', error)
    }
  }

  const loadData = async () => {
    try {
      const [projectsResult, customersResult, managersResult, estimatesResult] = await Promise.all([
        supabase
          .from('projects')
          .select(`
            *,
            customer:customers(*),
            project_manager_profile:profiles!project_manager(*)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('first_name'),
        supabase.from('profiles').select('*').in('role', ['admin', 'manager']).order('first_name'),
        supabase.from('estimates').select('*').eq('status', 'approved').order('estimate_number')
      ])

      console.log('Projects data:', projectsResult)
      if (projectsResult.error) {
        console.error('Projects query error:', projectsResult.error)
      }

      // Manually fetch customer sites for each project
      const projectsWithSites = await Promise.all(
        (projectsResult.data || []).map(async (project) => {
          if (project.customer_site_id) {
            const { data: customerSite } = await supabase
              .from('customer_sites')
              .select('*')
              .eq('id', project.customer_site_id)
              .single()
            return { ...project, customer_site: customerSite }
          }
          return project
        })
      )

      setProjects(projectsWithSites)
      setCustomers(customersResult.data || [])
      setManagers(managersResult.data || [])
      setEstimates(estimatesResult.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCustomerSites = async (customerId: string) => {
    try {
      setLoadingSites(true)
      const { data, error } = await supabase
        .from('customer_sites')
        .select('*')
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('site_name')

      if (error) throw error
      setCustomerSites(data || [])
    } catch (error) {
      console.error('Error loading customer sites:', error)
      setCustomerSites([])
    } finally {
      setLoadingSites(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
      
      if (!profile) throw new Error('User profile not found')

      const projectData = {
        company_id: profile.company_id,
        project_number: formData.project_number,
        project_name: formData.project_name,
        description: formData.description || null,
        customer_id: formData.customer_id,
        customer_site_id: formData.customer_site_id || null,
        project_manager: formData.project_manager || null,
        start_date: formData.start_date || null,
        estimated_end_date: formData.estimated_end_date || null,
        total_budget: formData.total_budget ? parseFloat(formData.total_budget) : 0,
        status: formData.status,
        priority: formData.priority,
        notes: formData.notes || null,
        estimate_id: formData.estimate_id || null
      }

      if (editingProject) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', editingProject.id)
        if (error) throw error
      } else {
        const { formattedNumber: projectNumber, nextSequence } = await getNextNumber('project')
        projectData.project_number = projectNumber
        
        const { error } = await supabase
          .from('projects')
          .insert([projectData])
        if (error) throw error
        
        // Update the sequence number
        await updateNextNumber('project', nextSequence)
      }

      setShowForm(false)
      setEditingProject(null)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving project:', error)
      alert('Error saving project: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      project_number: '',
      project_name: '',
      description: '',
      customer_id: '',
      customer_site_id: '',
      project_manager: '',
      start_date: '',
      estimated_end_date: '',
      total_budget: '',
      status: 'planning',
      priority: 'medium',
      notes: '',
      estimate_id: ''
    })
    setCustomerSites([])
  }

  const startEdit = (project: Project) => {
    setEditingProject(project)
    setFormData({
      project_number: project.project_number,
      project_name: project.project_name,
      description: project.description || '',
      customer_id: project.customer_id,
      customer_site_id: project.customer_site_id || '',
      project_manager: project.project_manager || '',
      start_date: project.start_date || '',
      estimated_end_date: project.estimated_end_date || '',
      total_budget: project.total_budget.toString(),
      status: project.status,
      priority: project.priority,
      notes: project.notes || '',
      estimate_id: project.estimate_id || ''
    })
    
    // Load customer sites for the selected customer
    if (project.customer_id) {
      loadCustomerSites(project.customer_id)
    }
    
    setShowForm(true)
  }

  const deleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project? This will also affect any related work orders.')) return

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const updateData: any = { status }
      if (status === 'completed') {
        updateData.actual_end_date = new Date().toISOString().split('T')[0]
      }

      const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const convertToWorkOrder = async (project: Project) => {
    if (!confirm(`Convert project "${project.project_name}" to a work order?`)) return

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

      // Generate work order number
      const { formattedNumber: woNumber, nextSequence } = await getNextNumber('work_order')
      
      // Create work order from project
      const workOrderData = {
        company_id: profile.company_id,
        wo_number: woNumber,
        customer_id: project.customer_id,
        customer_site_id: project.customer_site_id,
        project_id: project.id,
        title: project.project_name,
        description: project.description,
        priority: project.priority === 'urgent' ? 'urgent' : 
                 project.priority === 'high' ? 'high' : 
                 project.priority === 'low' ? 'low' : 'medium',
        status: 'open',
        notes: `Converted from project: ${project.project_number}`
      }

      const { error } = await supabase
        .from('work_orders')
        .insert([workOrderData])
      
      if (error) throw error
      
      // Update the sequence number
      await updateNextNumber('work_order', nextSequence)

      alert(`Work order ${woNumber} created successfully from project ${project.project_number}!`)
    } catch (error) {
      console.error('Error converting to work order:', error)
      alert('Error converting project to work order: ' + (error as Error).message)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-700 bg-green-100'
      case 'in_progress': return 'text-blue-700 bg-blue-100'
      case 'on_hold': return 'text-yellow-700 bg-yellow-100'
      case 'planning': return 'text-purple-700 bg-purple-100'
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

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.project_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (project.customer?.customer_type === 'residential' 
                           ? `${project.customer?.first_name} ${project.customer?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
                           : project.customer?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
                         )
    const matchesStatus = !statusFilter || project.status === statusFilter
    const matchesPriority = !priorityFilter || project.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })

  if (loading && projects.length === 0) {
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
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <button
          onClick={() => {
            resetForm()
            setEditingProject(null)
            setShowForm(true)
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <Target className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-gray-900">{projects.filter(p => p.status === 'in_progress').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{projects.filter(p => p.status === 'completed').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <DollarSign className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900">
                ${projects.reduce((sum, p) => sum + p.total_budget, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search projects..."
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
            <option value="planning">Planning</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
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

      {/* Projects Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {viewType === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Manager
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timeline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedProject(project)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{project.project_number}</div>
                      <div className="text-sm text-gray-500">{project.project_name}</div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {project.customer?.customer_type === 'residential' 
                          ? `${project.customer?.first_name} ${project.customer?.last_name}`
                          : project.customer?.company_name
                        }
                      </div>
                      {project.customer_site && (
                        <div className="text-xs text-gray-500">{project.customer_site.site_name}</div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {project.project_manager_profile ? 
                          `${project.project_manager_profile.first_name} ${project.project_manager_profile.last_name}` : 
                          'Unassigned'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={project.status}
                        onChange={(e) => updateStatus(project.id, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${getStatusColor(project.status)}`}
                      >
                        <option value="planning">Planning</option>
                        <option value="in_progress">In Progress</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${project.total_budget.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        Cost: ${project.actual_cost.toLocaleString()}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {project.start_date ? new Date(project.start_date).toLocaleDateString() : 'Not set'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {project.estimated_end_date ? `Due: ${new Date(project.estimated_end_date).toLocaleDateString()}` : 'No due date'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            convertToWorkOrder(project)
                          }}
                          className="text-purple-600 hover:text-purple-800 p-1.5 transition-all duration-200 hover:bg-purple-100 rounded-full hover:shadow-sm transform hover:scale-110"
                          title="Convert to Work Order"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedProject(project)
                          }}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startEdit(project)
                          }}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteProject(project.id)
                          }}
                          className="text-red-600 hover:text-red-800 p-1.5 transition-all duration-200 hover:bg-red-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
              {filteredProjects.map((project) => (
                <div key={project.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedProject(project)}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.project_number}</h3>
                      <p className="text-sm text-gray-600 mb-2">{project.project_name}</p>
                      <div className="flex space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
                          {project.status.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(project.priority)}`}>
                          {project.priority.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Building2 className="w-4 h-4 mr-3" />
                      <span>
                        {project.customer?.customer_type === 'residential' 
                          ? `${project.customer?.first_name} ${project.customer?.last_name}`
                          : project.customer?.company_name
                        }
                      </span>
                    </div>
                    
                    {project.customer_site && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Building2 className="w-4 h-4 mr-3" />
                        <span>{project.customer_site.site_name}</span>
                      </div>
                    )}
                    
                    {project.project_manager_profile && (
                      <div className="flex items-center text-sm text-gray-600">
                        <User className="w-4 h-4 mr-3" />
                        <span>{project.project_manager_profile.first_name} {project.project_manager_profile.last_name}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <DollarSign className="w-4 h-4 mr-3" />
                      <span>Budget: ${project.total_budget.toLocaleString()}</span>
                    </div>
                    
                    {project.estimated_end_date && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-3" />
                        <span>Due: {new Date(project.estimated_end_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      {project.source_estimate && `From Estimate: ${project.source_estimate.estimate_number}`}
                    </div>
                    <div className="flex space-x-2">
                       <button
                         onClick={(e) => {
                           e.stopPropagation()
                           convertToWorkOrder(project)
                         }}
                         className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors text-sm"
                       >
                         <ArrowRight className="w-4 h-4 mr-1" />
                         Convert to WO
                       </button>
                      <div className="text-blue-600 text-sm font-medium">
                        Click to view →
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingProject ? 'Edit Project' : 'Create New Project'}
                </h3>
                <div className="text-sm text-blue-600 font-medium">
                  Project Number: {formData.project_number}
                </div>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={formData.project_name}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer *
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Customer</option>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Site
                  </label>
                  <select
                    value={formData.customer_site_id}
                    onChange={(e) => setFormData({ ...formData, customer_site_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!formData.customer_id}
                  >
                    <option value="">Main Location</option>
                    {loadingSites ? (
                      <option disabled>Loading sites...</option>
                    ) : customerSites.length > 0 ? (
                      customerSites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.site_name}
                        </option>
                      ))
                    ) : (
                      formData.customer_id && <option disabled>No additional sites found</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Manager
                  </label>
                  <select
                    value={formData.project_manager}
                    onChange={(e) => setFormData({ ...formData, project_manager: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Unassigned</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.first_name} {manager.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="planning">Planning</option>
                    <option value="in_progress">In Progress</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated End Date
                  </label>
                  <input
                    type="date"
                    value={formData.estimated_end_date}
                    onChange={(e) => setFormData({ ...formData, estimated_end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Budget
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.total_budget}
                    onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source Estimate
                  </label>
                  <select
                    value={formData.estimate_id}
                    onChange={(e) => setFormData({ ...formData, estimate_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No source estimate</option>
                    {estimates.map((estimate) => (
                      <option key={estimate.id} value={estimate.id}>
                        {estimate.estimate_number} - ${estimate.total_amount.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : (editingProject ? 'Update Project' : 'Create Project')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  Project {selectedProject.project_number}
                </h3>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Project Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Name:</span>
                      <span className="text-sm text-gray-900">{selectedProject.project_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Status:</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedProject.status)}`}>
                        {selectedProject.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Priority:</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedProject.priority)}`}>
                        {selectedProject.priority.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Budget:</span>
                      <span className="text-sm text-gray-900">${selectedProject.total_budget.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Actual Cost:</span>
                      <span className="text-sm text-gray-900">${selectedProject.actual_cost.toLocaleString()}</span>
                    </div>
                    {selectedProject.start_date && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Start Date:</span>
                        <span className="text-sm text-gray-900">
                          {new Date(selectedProject.start_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {selectedProject.estimated_end_date && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Est. End Date:</span>
                        <span className="text-sm text-gray-900">
                          {new Date(selectedProject.estimated_end_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {selectedProject.description && (
                    <div className="mt-6">
                      <h5 className="text-md font-medium text-gray-900 mb-3">Description</h5>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700">{selectedProject.description}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Customer & Team</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Customer:</span>
                      <span className="text-sm text-gray-900">
                        {selectedProject.customer?.customer_type === 'residential' 
                          ? `${selectedProject.customer?.first_name} ${selectedProject.customer?.last_name}`
                          : selectedProject.customer?.company_name
                        }
                      </span>
                    </div>
                    {selectedProject.customer_site && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Site:</span>
                        <span className="text-sm text-gray-900">{selectedProject.customer_site.site_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Project Manager:</span>
                      <span className="text-sm text-gray-900">
                        {selectedProject.project_manager_profile ? 
                          `${selectedProject.project_manager_profile.first_name} ${selectedProject.project_manager_profile.last_name}` : 
                          'Unassigned'
                        }
                      </span>
                    </div>
                    {selectedProject.source_estimate && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Source Estimate:</span>
                        <span className="text-sm text-gray-900">{selectedProject.source_estimate.estimate_number}</span>
                      </div>
                    )}
                  </div>

                  {selectedProject.customer && (
                    <div className="mt-6">
                      <h5 className="text-md font-medium text-gray-900 mb-3">Customer Contact</h5>
                      <div className="space-y-2">
                        {selectedProject.customer.email && (
                          <div className="flex items-center text-sm text-gray-600">
                            <span className="font-medium mr-2">Email:</span>
                            <span>{selectedProject.customer.email}</span>
                          </div>
                        )}
                        {selectedProject.customer.phone && (
                          <div className="flex items-center text-sm text-gray-600">
                            <span className="font-medium mr-2">Phone:</span>
                            <span>{selectedProject.customer.phone}</span>
                          </div>
                        )}
                        {selectedProject.customer.address && (
                          <div className="flex items-center text-sm text-gray-600">
                            <span className="font-medium mr-2">Address:</span>
                            <span>{selectedProject.customer.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedProject.notes && (
                <div className="mt-8">
                  <h5 className="text-md font-medium text-gray-900 mb-3">Notes</h5>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">{selectedProject.notes}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => startEdit(selectedProject)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit Project
                </button>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}