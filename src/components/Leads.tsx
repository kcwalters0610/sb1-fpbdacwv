import React, { useState, useEffect } from 'react'
import { Plus, Search, Phone, Mail, MapPin, Calendar, User, DollarSign, Edit, Trash2, ArrowRight, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'

interface Lead {
  id: string
  company_id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  company?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  source: 'website' | 'referral' | 'cold_call' | 'social_media' | 'advertisement' | 'other'
  status: 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted'
  priority: 'low' | 'medium' | 'high'
  assigned_to?: string
  estimated_value?: number
  notes?: string
  last_contact_date?: string
  next_follow_up?: string
  created_at: string
  updated_at: string
  assigned_user?: any
}

export default function Leads() {
  const { viewType, setViewType } = useViewPreference('leads')
  const [leads, setLeads] = useState<Lead[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    source: 'website',
    status: 'new',
    priority: 'medium',
    assigned_to: '',
    estimated_value: '',
    notes: '',
    next_follow_up: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [leadsResult, usersResult] = await Promise.all([
        supabase
          .from('leads')
          .select(`
            *,
            assigned_user:profiles!leads_assigned_to_fkey(*)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('*')
          .in('role', ['admin', 'manager', 'office'])
          .order('first_name')
      ])

      setLeads(leadsResult.data || [])
      setUsers(usersResult.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
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
      
      if (!profile?.company_id) throw new Error('User company not found')

      const leadData = {
        company_id: profile.company_id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        company: formData.company || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        zip_code: formData.zip_code || null,
        source: formData.source,
        status: formData.status,
        priority: formData.priority,
        assigned_to: formData.assigned_to || null,
        estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
        notes: formData.notes || null,
        next_follow_up: formData.next_follow_up || null
      }

      if (editingLead) {
        const { error } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', editingLead.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('leads')
          .insert([leadData])
        if (error) throw error
      }

      setShowForm(false)
      setEditingLead(null)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving lead:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      company: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      source: 'website',
      status: 'new',
      priority: 'medium',
      assigned_to: '',
      estimated_value: '',
      notes: '',
      next_follow_up: ''
    })
  }

  const startEdit = (lead: Lead) => {
    setEditingLead(lead)
    setFormData({
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      address: lead.address || '',
      city: lead.city || '',
      state: lead.state || '',
      zip_code: lead.zip_code || '',
      source: lead.source,
      status: lead.status,
      priority: lead.priority,
      assigned_to: lead.assigned_to || '',
      estimated_value: lead.estimated_value?.toString() || '',
      notes: lead.notes || '',
      next_follow_up: lead.next_follow_up || ''
    })
    setShowForm(true)
  }

  const deleteLead = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting lead:', error)
    }
  }

  const convertToOpportunity = async (lead: Lead) => {
    if (!confirm('Convert this lead to an opportunity?')) return

    try {
      // Create opportunity
      const opportunityData = {
        title: `${lead.first_name} ${lead.last_name} - ${lead.company || 'Opportunity'}`,
        description: lead.notes,
        value: lead.estimated_value || 0,
        probability: 50,
        stage: 'prospecting',
        source: lead.source,
        assigned_to: lead.assigned_to,
        lead_id: lead.id
      }

      const { error: oppError } = await supabase
        .from('opportunities')
        .insert([opportunityData])

      if (oppError) throw oppError

      // Update lead status to converted
      const { error: leadError } = await supabase
        .from('leads')
        .update({ status: 'converted' })
        .eq('id', lead.id)

      if (leadError) throw leadError

      alert('Lead successfully converted to opportunity!')
      loadData()
    } catch (error) {
      console.error('Error converting lead:', error)
      alert('Error converting lead to opportunity')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'converted': return 'text-green-700 bg-green-100'
      case 'qualified': return 'text-blue-700 bg-blue-100'
      case 'contacted': return 'text-purple-700 bg-purple-100'
      case 'unqualified': return 'text-red-700 bg-red-100'
      case 'new': return 'text-yellow-700 bg-yellow-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-700 bg-red-100'
      case 'medium': return 'text-yellow-700 bg-yellow-100'
      case 'low': return 'text-green-700 bg-green-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'website': return 'text-blue-700 bg-blue-100'
      case 'referral': return 'text-green-700 bg-green-100'
      case 'cold_call': return 'text-purple-700 bg-purple-100'
      case 'social_media': return 'text-pink-700 bg-pink-100'
      case 'advertisement': return 'text-orange-700 bg-orange-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.company?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !statusFilter || lead.status === statusFilter
    const matchesSource = !sourceFilter || lead.source === sourceFilter
    return matchesSearch && matchesStatus && matchesSource
  })

  if (loading && leads.length === 0) {
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
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <button
          onClick={() => {
            resetForm()
            setEditingLead(null)
            setShowForm(true)
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Lead
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search leads..."
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
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="unqualified">Unqualified</option>
            <option value="converted">Converted</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Sources</option>
            <option value="website">Website</option>
            <option value="referral">Referral</option>
            <option value="cold_call">Cold Call</option>
            <option value="social_media">Social Media</option>
            <option value="advertisement">Advertisement</option>
            <option value="other">Other</option>
          </select>
          <div className="flex justify-end">
            <ViewToggle viewType={viewType} onViewChange={setViewType} />
          </div>
        </div>
      </div>

      {/* Leads Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {viewType === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lead
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {lead.first_name} {lead.last_name}
                        </div>
                        {lead.company && (
                          <div className="text-sm text-gray-500">{lead.company}</div>
                        )}
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(lead.priority)}`}>
                          {lead.priority} priority
                        </span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{lead.email}</div>
                      <div className="text-sm text-gray-500">{lead.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSourceColor(lead.source)}`}>
                        {lead.source.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lead.estimated_value ? `$${lead.estimated_value.toLocaleString()}` : '-'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lead.assigned_user ? 
                        `${lead.assigned_user.first_name} ${lead.assigned_user.last_name}` : 
                        'Unassigned'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {lead.status === 'qualified' && (
                          <button 
                            onClick={() => convertToOpportunity(lead)}
                            className="text-purple-600 hover:text-purple-900 p-1.5 transition-all duration-200 hover:bg-purple-100 rounded-full hover:shadow-sm transform hover:scale-110"
                            title="Convert to Opportunity"
                          >
                            <Zap className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(lead)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteLead(lead.id)}
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
              {filteredLeads.map((lead) => (
                <div key={lead.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {lead.first_name} {lead.last_name}
                      </h3>
                      {lead.company && (
                        <p className="text-sm text-gray-600 mb-2">{lead.company}</p>
                      )}
                      <div className="flex space-x-2 mb-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>
                          {lead.status}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(lead.priority)}`}>
                          {lead.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    {lead.email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="w-4 h-4 mr-3" />
                        <span>{lead.email}</span>
                      </div>
                    )}
                    
                    {lead.phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="w-4 h-4 mr-3" />
                        <span>{lead.phone}</span>
                      </div>
                    )}
                    
                    {lead.estimated_value && (
                      <div className="flex items-center text-sm text-gray-600">
                        <DollarSign className="w-4 h-4 mr-3" />
                        <span>${lead.estimated_value.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="flex items-center text-sm text-gray-600">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSourceColor(lead.source)}`}>
                        {lead.source.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="flex space-x-2">
                      {lead.status === 'qualified' && (
                        <button
                          onClick={() => convertToOpportunity(lead)}
                          className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors text-sm"
                        >
                          <ArrowRight className="w-4 h-4 mr-1" />
                          Convert
                        </button>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEdit(lead)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteLead(lead.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
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
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingLead ? 'Edit Lead' : 'Add New Lead'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source *
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="cold_call">Cold Call</option>
                    <option value="social_media">Social Media</option>
                    <option value="advertisement">Advertisement</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="unqualified">Unqualified</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority *
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assigned To
                  </label>
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Value
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.estimated_value}
                    onChange={(e) => setFormData({ ...formData, estimated_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Next Follow Up
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.next_follow_up}
                    onChange={(e) => setFormData({ ...formData, next_follow_up: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : (editingLead ? 'Update' : 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}