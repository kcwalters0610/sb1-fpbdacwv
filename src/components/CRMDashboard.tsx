import React, { useState, useEffect } from 'react'
import { Plus, Users, Target, DollarSign, TrendingUp, ArrowRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { supabase } from '../lib/supabase'

interface Lead {
  id: string
  first_name: string
  last_name: string
  company?: string
  status: string
  estimated_value?: number
  created_at: string
}

interface Opportunity {
  id: string
  title: string
  value: number
  stage: string
  probability: number
  created_at: string
  lead?: any
  customer?: any
}

interface CRMDashboardProps {
  onPageChange?: (page: string) => void
}

export default function CRMDashboard({ onPageChange }: CRMDashboardProps = {}) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCRMData()
  }, [])

  const loadCRMData = async () => {
    try {
      const [leadsResult, opportunitiesResult] = await Promise.all([
        supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('opportunities')
          .select(`
            *,
            lead:leads(*),
            customer:customers(*)
          `)
          .order('created_at', { ascending: false })
      ])

      setLeads(leadsResult.data || [])
      setOpportunities(opportunitiesResult.data || [])
    } catch (error) {
      console.error('Error loading CRM data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate metrics
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  
  const newLeadsThisMonth = leads.filter(lead => {
    const leadDate = new Date(lead.created_at)
    return leadDate.getMonth() === currentMonth && leadDate.getFullYear() === currentYear
  }).length

  const openOpportunities = opportunities.filter(opp => 
    !['closed_won', 'closed_lost'].includes(opp.stage)
  )

  const wonDeals = opportunities.filter(opp => opp.stage === 'closed_won')
  const avgDealSize = wonDeals.length > 0 
    ? wonDeals.reduce((sum, opp) => sum + opp.value, 0) / wonDeals.length 
    : 0

  const totalLeads = leads.length
  const convertedLeads = leads.filter(lead => lead.status === 'converted').length
  const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

  const totalPotential = openOpportunities.reduce((sum, opp) => sum + opp.value, 0)

  // Lead status distribution data
  const leadStatusData = [
    { name: 'New', count: leads.filter(l => l.status === 'new').length, color: '#3B82F6' },
    { name: 'Contacted', count: leads.filter(l => l.status === 'contacted').length, color: '#8B5CF6' },
    { name: 'Qualified', count: leads.filter(l => l.status === 'qualified').length, color: '#10B981' },
    { name: 'Unqualified', count: leads.filter(l => l.status === 'unqualified').length, color: '#EF4444' },
    { name: 'Converted', count: leads.filter(l => l.status === 'converted').length, color: '#F59E0B' }
  ].filter(item => item.count > 0)

  // Opportunity pipeline data
  const pipelineData = [
    { 
      name: 'Open', 
      count: opportunities.filter(o => ['prospecting', 'qualification', 'proposal', 'negotiation'].includes(o.stage)).length 
    },
    { 
      name: 'Won', 
      count: opportunities.filter(o => o.stage === 'closed_won').length 
    },
    { 
      name: 'Lost', 
      count: opportunities.filter(o => o.stage === 'closed_lost').length 
    }
  ]

  // Recent leads and opportunities
  const recentLeads = leads.slice(0, 5)
  const recentOpportunities = opportunities.slice(0, 5)

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
          <h1 className="text-2xl font-bold text-gray-900">CRM Dashboard</h1>
          <p className="text-gray-600">Manage your sales pipeline and customer relationships</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => onPageChange?.('leads')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <Users className="w-5 h-5 mr-2" />
            Add Lead
          </button>
          <button 
            onClick={() => onPageChange?.('opportunities')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Opportunity
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover-card-effect">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Leads</p>
              <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400">{totalLeads}</p>
              <p className="text-sm text-blue-600 mt-1">{newLeadsThisMonth} new this month</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full shadow-sm">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover-card-effect">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Open Opportunities</p>
              <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400">{openOpportunities.length}</p>
              <p className="text-sm text-blue-600 mt-1">${totalPotential.toLocaleString()} potential</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full shadow-sm">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover-card-effect">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Deal Size</p>
              <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-green-400">${Math.round(avgDealSize).toLocaleString()}</p>
              <p className="text-sm text-gray-600 mt-1">{wonDeals.length} deals won</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full shadow-sm">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover-card-effect">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
              <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-purple-400">{conversionRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full shadow-sm">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        {/* Lead Status Distribution */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-300">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Lead Status Distribution</h3>
          {leadStatusData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leadStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {leadStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {leadStatusData.map((item, index) => (
                  <div key={index} className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-sm text-gray-600">{item.name}: {item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No lead data available
            </div>
          )}
        </div>

        {/* Opportunity Pipeline */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-300">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Opportunity Pipeline</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <Bar 
                  dataKey="count" 
                  fill="#3B82F6" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Leads</h3>
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
              <span onClick={() => onPageChange?.('leads')}>View All</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
          {recentLeads.length > 0 ? (
            <div className="space-y-4">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {lead.first_name} {lead.last_name}
                    </p>
                    {lead.company && (
                      <p className="text-sm text-gray-600">{lead.company}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      lead.status === 'new' ? 'text-blue-700 bg-blue-100' :
                      lead.status === 'contacted' ? 'text-purple-700 bg-purple-100' :
                      lead.status === 'qualified' ? 'text-green-700 bg-green-100' :
                      lead.status === 'converted' ? 'text-yellow-700 bg-yellow-100' :
                      'text-red-700 bg-red-100'
                    }`}>
                      {lead.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No recent leads
            </div>
          )}
        </div>

        {/* Recent Opportunities */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Opportunities</h3>
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
              <span onClick={() => onPageChange?.('opportunities')}>View All</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
          {recentOpportunities.length > 0 ? (
            <div className="space-y-4">
              {recentOpportunities.map((opportunity) => (
                <div key={opportunity.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{opportunity.title}</p>
                    <p className="text-sm text-gray-600">
                      {opportunity.lead ? 
                        `${opportunity.lead.first_name} ${opportunity.lead.last_name}` :
                        opportunity.customer ?
                        (opportunity.customer.customer_type === 'residential' 
                          ? `${opportunity.customer.first_name} ${opportunity.customer.last_name}`
                          : opportunity.customer.company_name
                        ) : 'No contact'
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${opportunity.value.toLocaleString()}</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      opportunity.stage === 'closed_won' ? 'text-green-700 bg-green-100' :
                      opportunity.stage === 'closed_lost' ? 'text-red-700 bg-red-100' :
                      opportunity.stage === 'negotiation' ? 'text-blue-700 bg-blue-100' :
                      opportunity.stage === 'proposal' ? 'text-purple-700 bg-purple-100' :
                      'text-yellow-700 bg-yellow-100'
                    }`}>
                      {opportunity.stage.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No recent opportunities
            </div>
          )}
        </div>
      </div>
    </div>
  )
}