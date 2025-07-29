import React, { useState, useEffect } from 'react'
import { Plus, Search, DollarSign, Calendar, User, TrendingUp, Edit, Trash2, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'

interface Opportunity {
  id: string
  company_id: string
  lead_id?: string
  customer_id?: string
  title: string
  description?: string
  value: number
  probability: number
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
  source: 'website' | 'referral' | 'cold_call' | 'social_media' | 'advertisement' | 'other'
  assigned_to?: string
  expected_close_date?: string
  actual_close_date?: string
  notes?: string
  created_at: string
  updated_at: string
  assigned_user?: any
  lead?: any
  customer?: any
}

export default function Opportunities() {
  const { viewType, setViewType } = useViewPreference('opportunities')
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [stageFilter, setStageFilter] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    value: '',
    probability: '50',
    stage: 'prospecting',
    source: 'website',
    assigned_to: '',
    expected_close_date: '',
    lead_id: '',
    customer_id: '',
    notes: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [oppsResult, usersResult, leadsResult, customersResult] = await Promise.all([
        supabase
          .from('opportunities')
          .select(`
            *,
            assigned_user:profiles!opportunities_assigned_to_fkey(*),
            lead:leads(*),
            customer:customers(*)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('*')
          .in('role', ['admin', 'manager', 'office'])
          .order('first_name'),
        supabase
          .from('leads')
          .select('*') 
          .order('first_name'),
        supabase
          .from('customers')
          .select('*')
          .order('first_name')
      ])

      setOpportunities(oppsResult.data || [])
      setUsers(usersResult.data || [])
      setLeads(leadsResult.data || [])
      setCustomers(customersResult.data || [])
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
      
      if (!profile) throw new Error('User profile not found')

      const opportunityData = {
        company_id: profile.company_id,
        title: formData.title,
        description: formData.description || null,
        value: parseFloat(formData.value) || 0,
        probability: parseInt(formData.probability),
        stage: formData.stage,
        source: formData.source,
        assigned_to: formData.assigned_to || null,
        expected_close_date: formData.expected_close_date || null,
        lead_id: formData.lead_id || null,
        customer_id: formData.customer_id || null,
        notes: formData.notes || null
      }

      if (editingOpportunity) {
        const { error } = await supabase
          .from('opportunities')
          .update(opportunityData)
          .eq('id', editingOpportunity.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('opportunities')
          .insert([opportunityData])
        if (error) throw error
      }

      setShowForm(false)
      setEditingOpportunity(null)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving opportunity:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      value: '',
      probability: '50',
      stage: 'prospecting',
      source: 'website',
      assigned_to: '',
      expected_close_date: '',
      lead_id: '',
      customer_id: '',
      notes: ''
    })
  }

  const startEdit = (opportunity: Opportunity) => {
    setEditingOpportunity(opportunity)
    setFormData({
      title: opportunity.title,
      description: opportunity.description || '',
      value: opportunity.value.toString(),
      probability: opportunity.probability.toString(),
      stage: opportunity.stage,
      source: opportunity.source,
      assigned_to: opportunity.assigned_to || '',
      expected_close_date: opportunity.expected_close_date || '',
      lead_id: opportunity.lead_id || '',
      customer_id: opportunity.customer_id || '',
      notes: opportunity.notes || ''
    })
    setShowForm(true)
  }

  const deleteOpportunity = async (id: string) => {
    if (!confirm('Are you sure you want to delete this opportunity?')) return

    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting opportunity:', error)
    }
  }

  const updateStage = async (id: string, stage: string) => {
    try {
      const updateData: any = { stage }
      if (stage === 'closed_won' || stage === 'closed_lost') {
        updateData.actual_close_date = new Date().toISOString().split('T')[0]
      }

      const { error } = await supabase
        .from('opportunities')
        .update(updateData)
        .eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error updating stage:', error)
    }
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'closed_won': return 'text-green-700 bg-green-100'
      case 'closed_lost': return 'text-red-700 bg-red-100'
      case 'negotiation': return 'text-blue-700 bg-blue-100'
      case 'proposal': return 'text-purple-700 bg-purple-100'
      case 'qualification': return 'text-yellow-700 bg-yellow-100'
      case 'prospecting': return 'text-gray-700 bg-gray-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  const getProbabilityColor = (probability: number) => {
    if (probability >= 80) return 'text-green-700 bg-green-100'
    if (probability >= 60) return 'text-blue-700 bg-blue-100'
    if (probability >= 40) return 'text-yellow-700 bg-yellow-100'
    return 'text-red-700 bg-red-100'
  }

  const filteredOpportunities = opportunities.filter(opp => {
    const matchesSearch = opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         opp.lead?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         opp.customer?.first_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStage = !stageFilter || opp.stage === stageFilter
    return matchesSearch && matchesStage
  })

  const totalValue = filteredOpportunities.reduce((sum, opp) => sum + opp.value, 0)
  const weightedValue = filteredOpportunities.reduce((sum, opp) => sum + (opp.value * opp.probability / 100), 0)

  if (loading && opportunities.length === 0) {
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
        <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
        <button
          onClick={() => {
            resetForm()
            setEditingOpportunity(null)
            setShowForm(true)
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Opportunity
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <Target className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Opportunities</p>
              <p className="text-2xl font-bold text-gray-900">{filteredOpportunities.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <DollarSign className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">${totalValue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Weighted Value</p>
              <p className="text-2xl font-bold text-gray-900">${weightedValue.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search opportunities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Stages</option>
            <option value="prospecting">Prospecting</option>
            <option value="qualification">Qualification</option>
            <option value="proposal">Proposal</option>
            <option value="negotiation">Negotiation</option>
            <option value="closed_won">Closed Won</option>
            <option value="closed_lost">Closed Lost</option>
          </select>
          <div className="flex justify-end">
            <ViewToggle viewType={viewType} onViewChange={setViewType} />
          </div>
        </div>
      </div>

      {/* Opportunities Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {viewType === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Opportunity
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Probability
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Close Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOpportunities.map((opportunity) => (
                  <tr key={opportunity.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{opportunity.title}</div>
                        <div className="text-sm text-gray-500">
                          {opportunity.assigned_user ? 
                            `${opportunity.assigned_user.first_name} ${opportunity.assigned_user.last_name}` : 
                            'Unassigned'
                          }
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {opportunity.lead ? 
                          `${opportunity.lead.first_name} ${opportunity.lead.last_name}` :
                          opportunity.customer ?
                          (opportunity.customer.customer_type === 'residential' 
                            ? `${opportunity.customer.first_name} ${opportunity.customer.last_name}`
                            : opportunity.customer.company_name
                          ) : 'No contact'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${opportunity.value.toLocaleString()}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getProbabilityColor(opportunity.probability)}`}>
                        {opportunity.probability}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={opportunity.stage}
                        onChange={(e) => updateStage(opportunity.id, e.target.value)}
                        className={`text-xs font-medium rounded-full px-2 py-1 border-0 ${getStageColor(opportunity.stage)}`}
                      >
                        <option value="prospecting">Prospecting</option>
                        <option value="qualification">Qualification</option>
                        <option value="proposal">Proposal</option>
                        <option value="negotiation">Negotiation</option>
                        <option value="closed_won">Closed Won</option>
                        <option value="closed_lost">Closed Lost</option>
                      </select>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {opportunity.expected_close_date ? 
                        new Date(opportunity.expected_close_date).toLocaleDateString() : 
                        'Not set'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => startEdit(opportunity)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteOpportunity(opportunity.id)}
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
              {filteredOpportunities.map((opportunity) => (
                <div key={opportunity.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{opportunity.title}</h3>
                      <p className="text-2xl font-bold text-green-600 mb-2">${opportunity.value.toLocaleString()}</p>
                      <div className="flex space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStageColor(opportunity.stage)}`}>
                          {opportunity.stage.replace('_', ' ')}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getProbabilityColor(opportunity.probability)}`}>
                          {opportunity.probability}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="w-4 h-4 mr-3" />
                      <span>
                        {opportunity.lead ? 
                          `${opportunity.lead.first_name} ${opportunity.lead.last_name}` :
                          opportunity.customer ?
                          (opportunity.customer.customer_type === 'residential' 
                            ? `${opportunity.customer.first_name} ${opportunity.customer.last_name}`
                            : opportunity.customer.company_name
                          ) : 'No contact'
                        }
                      </span>
                    </div>
                    
                    {opportunity.expected_close_date && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-3" />
                        <span>Expected: {new Date(opportunity.expected_close_date).toLocaleDateString()}</span>
                      </div>
                    )}

                    <div className="flex items-center text-sm text-gray-600">
                      <DollarSign className="w-4 h-4 mr-3" />
                      <span>Weighted: ${(opportunity.value * opportunity.probability / 100).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <select
                      value={opportunity.stage}
                      onChange={(e) => updateStage(opportunity.id, e.target.value)}
                      className={`text-xs font-medium rounded px-2 py-1 border ${getStageColor(opportunity.stage)}`}
                    >
                      <option value="prospecting">Prospecting</option>
                      <option value="qualification">Qualification</option>
                      <option value="proposal">Proposal</option>
                      <option value="negotiation">Negotiation</option>
                      <option value="closed_won">Closed Won</option>
                      <option value="closed_lost">Closed Lost</option>
                    </select>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEdit(opportunity)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteOpportunity(opportunity.id)}
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
                {editingOpportunity ? 'Edit Opportunity' : 'Add New Opportunity'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Value *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Probability (%) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.probability}
                    onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stage *
                  </label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="prospecting">Prospecting</option>
                    <option value="qualification">Qualification</option>
                    <option value="proposal">Proposal</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="closed_won">Closed Won</option>
                    <option value="closed_lost">Closed Lost</option>
                  </select>
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
                    Expected Close Date
                  </label>
                  <input
                    type="date"
                    value={formData.expected_close_date}
                    onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Related Lead
                  </label>
                  <select
                    value={formData.lead_id}
                    onChange={(e) => setFormData({ ...formData, lead_id: e.target.value, customer_id: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No lead</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.first_name} {lead.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Related Customer
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value, lead_id: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!!formData.lead_id}
                  >
                    <option value="">No customer</option>
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
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : (editingOpportunity ? 'Update' : 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}