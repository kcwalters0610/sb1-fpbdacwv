import React, { useState, useEffect } from 'react'
import { Plus, Search, Mail, Phone, MapPin, Building2, User, Edit, Trash2, Eye, X, Star, ClipboardList, FileText, ShoppingCart, FolderOpen, ExternalLink } from 'lucide-react'
import { supabase, Customer, CustomerSite, Profile } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'

interface CustomersProps {
  currentPage?: string
  onPageChange?: (page: string) => void
  onNavigateToRecord?: (recordType: string, recordId: string) => void
}

export default function Customers({ currentPage, onPageChange, onNavigateToRecord }: CustomersProps = {}) {
  const { viewType, setViewType } = useViewPreference('customers')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [showSitesModal, setShowSitesModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showSiteForm, setShowSiteForm] = useState(false)
  const [editingSite, setEditingSite] = useState<CustomerSite | null>(null)
  const [customerSites, setCustomerSites] = useState<CustomerSite[]>([])
  const [customerBalances, setCustomerBalances] = useState<Record<string, number>>({})
  const [showCustomerDetail, setShowCustomerDetail] = useState(false)
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Customer | null>(null)
  const [customerWorkOrders, setCustomerWorkOrders] = useState<any[]>([])
  const [customerEstimates, setCustomerEstimates] = useState<any[]>([])
  const [customerPurchaseOrders, setCustomerPurchaseOrders] = useState<any[]>([])
  const [customerProjects, setCustomerProjects] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<string>('first_name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [siteFormData, setSiteFormData] = useState({
    site_name: '',
    contact_first_name: '',
    contact_last_name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    is_primary: false,
    notes: ''
  })

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    customer_type: 'residential'
  })

  useEffect(() => {
    loadUserProfile()
    loadCustomers()
    loadCustomerBalances()
  }, [])

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (error) throw error
        setUserProfile(data)
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('first_name')

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Error loading customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCustomerBalances = async () => {
    try {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('customer_id, total_amount, paid_amount, status')
        .in('status', ['sent', 'overdue'])

      if (error) throw error

      const balances: Record<string, number> = {}
      invoices?.forEach(invoice => {
        const outstanding = (invoice.total_amount || 0) - (invoice.paid_amount || 0)
        if (outstanding > 0) {
          balances[invoice.customer_id] = (balances[invoice.customer_id] || 0) + outstanding
        }
      })

      setCustomerBalances(balances)
    } catch (error) {
      console.error('Error loading customer balances:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!userProfile?.company_id) {
      console.error('No company_id found for user')
      return
    }
    
    setLoading(true)

    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(formData)
          .eq('id', editingCustomer.id)
        if (error) throw error
      } else {
        const customerData = {
          ...formData,
          company_id: userProfile.company_id
        }
        const { error } = await supabase
          .from('customers')
          .insert([customerData])
        if (error) throw error
      }

      setShowForm(false)
      setEditingCustomer(null)
      resetForm()
      loadCustomers()
    } catch (error) {
      console.error('Error saving customer:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCustomerSites = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_sites')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false })
        .order('site_name')

      if (error) throw error
      setCustomerSites(data || [])
    } catch (error) {
      console.error('Error loading customer sites:', error)
    }
  }

  const handleSiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedCustomer || !userProfile?.company_id) {
      console.error('No customer selected or company_id found')
      return
    }
    
    setLoading(true)

    try {
      const siteData = {
        customer_id: selectedCustomer.id,
        company_id: userProfile.company_id,
        site_name: siteFormData.site_name,
        contact_first_name: siteFormData.contact_first_name || null,
        contact_last_name: siteFormData.contact_last_name || null,
        contact_email: siteFormData.contact_email || null,
        contact_phone: siteFormData.contact_phone || null,
        address: siteFormData.address || null,
        city: siteFormData.city || null,
        state: siteFormData.state || null,
        zip_code: siteFormData.zip_code || null,
        is_primary: siteFormData.is_primary,
        notes: siteFormData.notes || null
      }

      if (editingSite) {
        const { error } = await supabase
          .from('customer_sites')
          .update(siteData)
          .eq('id', editingSite.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('customer_sites')
          .insert([siteData])
        if (error) throw error
      }

      setShowSiteForm(false)
      setEditingSite(null)
      resetSiteForm()
      loadCustomerSites(selectedCustomer.id)
      loadCustomers() // Refresh main customer list
    } catch (error) {
      console.error('Error saving site:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetSiteForm = () => {
    setSiteFormData({
      site_name: '',
      contact_first_name: '',
      contact_last_name: '',
      contact_email: '',
      contact_phone: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      is_primary: false,
      notes: ''
    })
  }

  const startEditSite = (site: CustomerSite) => {
    setEditingSite(site)
    setSiteFormData({
      site_name: site.site_name,
      contact_first_name: site.contact_first_name || '',
      contact_last_name: site.contact_last_name || '',
      contact_email: site.contact_email || '',
      contact_phone: site.contact_phone || '',
      address: site.address || '',
      city: site.city || '',
      state: site.state || '',
      zip_code: site.zip_code || '',
      is_primary: site.is_primary,
      notes: site.notes || ''
    })
    setShowSiteForm(true)
  }

  const deleteSite = async (id: string) => {
    if (!confirm('Are you sure you want to delete this site?')) return

    try {
      const { error } = await supabase
        .from('customer_sites')
        .delete()
        .eq('id', id)
      if (error) throw error
      
      if (selectedCustomer) {
        loadCustomerSites(selectedCustomer.id)
        loadCustomers() // Refresh main customer list
      }
    } catch (error) {
      console.error('Error deleting site:', error)
    }
  }

  const openSitesModal = (customer: Customer) => {
    setSelectedCustomer(customer)
    loadCustomerSites(customer.id)
    setShowSitesModal(true)
  }

  const openCustomerDetail = async (customer: Customer) => {
    setSelectedCustomerForDetail(customer)
    setDetailLoading(true)
    setShowCustomerDetail(true)

    try {
      // Load all associated records for this customer
      const [workOrdersResult, estimatesResult, purchaseOrdersResult, projectsResult] = await Promise.all([
        supabase
          .from('work_orders')
          .select(`
            *,
            assigned_technician:profiles!work_orders_assigned_to_fkey(first_name, last_name),
            customer_site:customer_sites(site_name)
          `)
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('estimates')
          .select(`
            *,
            customer_site:customer_sites(site_name)
          `)
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('purchase_orders')
          .select(`
            *,
            vendor:vendors(name),
            work_order:work_orders(wo_number, title)
          `)
          .in('work_order_id', 
            // Get work order IDs for this customer first
            (await supabase
              .from('work_orders')
              .select('id')
              .eq('customer_id', customer.id)
            ).data?.map(wo => wo.id) || []
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('projects')
          .select(`
            *,
            project_manager_profile:profiles!project_manager(first_name, last_name),
            customer_site:customer_sites(site_name)
          `)
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false })
      ])

      setCustomerWorkOrders(workOrdersResult.data || [])
      setCustomerEstimates(estimatesResult.data || [])
      setCustomerPurchaseOrders(purchaseOrdersResult.data || [])
      setCustomerProjects(projectsResult.data || [])
    } catch (error) {
      console.error('Error loading customer details:', error)
    } finally {
      setDetailLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-700 bg-green-100'
      case 'in_progress': return 'text-blue-700 bg-blue-100'
      case 'scheduled': return 'text-purple-700 bg-purple-100'
      case 'open': return 'text-yellow-700 bg-yellow-100'
      case 'cancelled': return 'text-red-700 bg-red-100'
      case 'approved': return 'text-green-700 bg-green-100'
      case 'sent': return 'text-blue-700 bg-blue-100'
      case 'draft': return 'text-gray-700 bg-gray-100'
      case 'rejected': return 'text-red-700 bg-red-100'
      case 'expired': return 'text-red-700 bg-red-100'
      case 'converted': return 'text-purple-700 bg-purple-100'
      case 'planning': return 'text-purple-700 bg-purple-100'
      case 'on_hold': return 'text-yellow-700 bg-yellow-100'
      case 'received': return 'text-green-700 bg-green-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  const handleRecordClick = (recordType: string, recordId: string) => {
    if (onNavigateToRecord) {
      onNavigateToRecord(recordType, recordId)
    } else {
      // Fallback: dispatch a custom event that the main app can listen to
      window.dispatchEvent(new CustomEvent('navigateToRecord', { 
        detail: { recordType, recordId } 
      }))
    }
    setShowCustomerDetail(false)
  }

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      company_name: '',
      email: '',
      phone: '',
      address: '',
      customer_type: 'residential'
    })
  }

  const startEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      first_name: customer.first_name,
      last_name: customer.last_name,
      company_name: customer.company_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      customer_type: customer.customer_type
    })
    setShowForm(true)
  }

  const deleteCustomer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
      if (error) throw error
      loadCustomers()
    } catch (error) {
      console.error('Error deleting customer:', error)
    }
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortedCustomers = (customers: Customer[]) => {
    return [...customers].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortField) {
        case 'name':
          aValue = a.customer_type === 'residential' 
            ? `${a.first_name} ${a.last_name}`.toLowerCase()
            : (a.company_name || '').toLowerCase()
          bValue = b.customer_type === 'residential' 
            ? `${b.first_name} ${b.last_name}`.toLowerCase()
            : (b.company_name || '').toLowerCase()
          break
        case 'email':
          aValue = (a.email || '').toLowerCase()
          bValue = (b.email || '').toLowerCase()
          break
        case 'phone':
          aValue = (a.phone || '').toLowerCase()
          bValue = (b.phone || '').toLowerCase()
          break
        case 'customer_type':
          aValue = a.customer_type.toLowerCase()
          bValue = b.customer_type.toLowerCase()
          break
        case 'created_at':
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        default:
          aValue = (a.first_name || '').toLowerCase()
          bValue = (b.first_name || '').toLowerCase()
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }

  const filteredCustomers = customers.filter(customer =>
    (customer.customer_type === 'residential' 
      ? `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
      : customer.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
    ) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const sortedAndFilteredCustomers = getSortedCustomers(filteredCustomers)

  const SortButton = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
    >
      <span>{children}</span>
      {sortField === field && (
        <span className="text-blue-600">
          {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  )

  if (loading && customers.length === 0) {
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
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <button
          onClick={() => {
            resetForm()
            setEditingCustomer(null)
            setShowForm(true)
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-4">
            <select
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const [field, direction] = e.target.value.split('-')
                setSortField(field)
                setSortDirection(direction as 'asc' | 'desc')
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="email-asc">Email A-Z</option>
              <option value="email-desc">Email Z-A</option>
              <option value="customer_type-asc">Type A-Z</option>
              <option value="customer_type-desc">Type Z-A</option>
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
            </select>
            <ViewToggle viewType={viewType} onViewChange={setViewType} />
          </div>
        </div>
      </div>

      {/* Customers Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {viewType === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <SortButton field="name">Customer</SortButton>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <SortButton field="customer_type">Type</SortButton>
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <SortButton field="email">Contact</SortButton>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount Due
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <SortButton field="created_at">Added</SortButton>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedAndFilteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center ${
                            customer.customer_type === 'commercial' ? 'bg-blue-100' : 'bg-green-100'
                          }`}>
                            {customer.customer_type === 'commercial' ? (
                              <Building2 className={`w-5 h-5 ${customer.customer_type === 'commercial' ? 'text-blue-600' : 'text-green-600'}`} />
                            ) : (
                              <User className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {customer.customer_type === 'residential'
                              ? `${customer.first_name} ${customer.last_name}`
                              : customer.company_name
                            }
                          </div>
                          {customer.customer_type === 'commercial' && (
                            <div className="text-sm text-gray-500">
                              {customer.first_name} {customer.last_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        customer.customer_type === 'commercial'
                          ? 'text-blue-700 bg-blue-100'
                          : 'text-green-700 bg-green-100'
                      }`}>
                        {customer.customer_type === 'commercial' ? 'Commercial' : 'Residential'}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{customer.email}</div>
                      <div className="text-sm text-gray-500">{customer.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        customerBalances[customer.id] > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        ${(customerBalances[customer.id] || 0).toFixed(2)}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{customer.address}</div>
                      <div className="text-sm text-gray-500">
                        {customer.city && customer.state && `${customer.city}, ${customer.state}`}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {customer.customer_type === 'commercial' && (
                        <button
                          onClick={() => openSitesModal(customer)}
                          className="text-purple-600 hover:text-purple-800 mr-2 sm:mr-3 p-1.5 transition-all duration-200 hover:bg-purple-100 rounded-full hover:shadow-sm transform hover:scale-110"
                          title="Manage Sites"
                        >
                          <Building2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(customer)}
                        className="text-blue-600 hover:text-blue-800 mr-2 sm:mr-3 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openCustomerDetail(customer)}
                        className="text-green-600 hover:text-green-800 mr-2 sm:mr-3 p-1.5 transition-all duration-200 hover:bg-green-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteCustomer(customer.id)}
                        className="text-red-600 hover:text-red-800 p-1.5 transition-all duration-200 hover:bg-red-100 rounded-full hover:shadow-sm transform hover:scale-110"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedAndFilteredCustomers.map((customer) => (
                <div key={customer.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        customer.customer_type === 'commercial' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        {customer.customer_type === 'commercial' ? (
                          <Building2 className="w-6 h-6 text-blue-600" />
                        ) : (
                          <User className="w-6 h-6 text-green-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {customer.customer_type === 'residential' 
                            ? `${customer.first_name} ${customer.last_name}`
                            : customer.company_name
                          }
                        </h3>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          customer.customer_type === 'commercial' 
                            ? 'text-blue-700 bg-blue-100' 
                            : 'text-green-700 bg-green-100'
                        }`}>
                          {customer.customer_type === 'commercial' ? 'Commercial' : 'Residential'}
                        </span>
                        {customer.customer_type === 'commercial' && customer.sites && customer.sites.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {customer.sites.length} site{customer.sites.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {customer.customer_type === 'commercial' && (
                        <button
                          onClick={() => openSitesModal(customer)}
                          className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                        >
                          Sites
                        </button>
                    <div className="flex items-center space-x-3 text-sm">
                      <button
                        onClick={() => loadCustomerSites(customer.id)}
                        className="text-purple-600 hover:text-purple-800 font-medium transition-colors"
                      >
                        Sites
                      </button>
                      <button
                        onClick={() => startEdit(customer)}
                        className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => viewCustomer(customer)}
                        className="text-green-600 hover:text-green-800 font-medium transition-colors"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => deleteCustomer(customer.id)}
                        className="text-red-600 hover:text-red-800 font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {customer.email && (
                      <div className="flex items-center text-gray-600">
                        <Mail className="w-4 h-4 mr-3" />
                        <span className="text-sm">{customer.email}</span>
                      </div>
                    )}
                    
                    {customer.phone && (
                      <div className="flex items-center text-gray-600">
                        <Phone className="w-4 h-4 mr-3" />
                        <span className="text-sm">{customer.phone}</span>
                      </div>
                    )}
                    
                    {customer.address && (
                      <div className="flex items-center text-gray-600">
                        <MapPin className="w-4 h-4 mr-3" />
                        <span className="text-sm">{customer.address}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Amount Due:</span>
                      <span className={`text-xl font-bold ${
                        customerBalances[customer.id] > 0 ? 'text-green-600' : 'text-green-600'
                      }`}>
                        ${(customerBalances[customer.id] || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Added on {new Date(customer.created_at).toLocaleDateString()}
                    </p>
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Type *
                </label>
                <select
                  value={formData.customer_type}
                  onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>

              {formData.customer_type === 'commercial' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={formData.customer_type === 'commercial'}
                  />
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact First Name *
                      </label>
                      <input
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required={formData.customer_type === 'commercial'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Last Name *
                      </label>
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required={formData.customer_type === 'commercial'}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required={formData.customer_type === 'residential'}
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
                      required={formData.customer_type === 'residential'}
                    />
                  </div>
                </div>
              )}

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
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
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
                  {loading ? 'Saving...' : (editingCustomer ? 'Update' : 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sites Management Modal */}
      {showSitesModal && selectedCustomer && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Manage Sites - {selectedCustomer.company_name}
                  </h3>
                  <p className="text-sm text-gray-600">Add and manage multiple locations for this commercial customer</p>
                  <div className="mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Amount Due:</span>
                      <span className={`text-xl font-bold ${
                        customerBalances[selectedCustomer.id] > 0 ? 'text-green-600' : 'text-green-600'
                      }`}>
                        ${(customerBalances[selectedCustomer.id] || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      resetSiteForm()
                      setEditingSite(null)
                      setShowSiteForm(true)
                    }}
                    className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Site
                  </button>
                  <button
                    onClick={() => setShowSitesModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {customerSites.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {customerSites.map((site) => (
                    <div key={site.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                              {site.site_name}
                              {site.is_primary && (
                                <Star className="w-4 h-4 ml-2 text-yellow-500 fill-current" />
                              )}
                            </h4>
                            {site.is_primary && (
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full text-yellow-700 bg-yellow-100">
                                Primary Site
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => startEditSite(site)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteSite(site.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {(site.contact_first_name || site.contact_last_name) && (
                          <div className="flex items-center text-gray-600">
                            <User className="w-4 h-4 mr-3" />
                            <span className="text-sm">
                              {site.contact_first_name} {site.contact_last_name}
                            </span>
                          </div>
                        )}
                        
                        {site.contact_email && (
                          <div className="flex items-center text-gray-600">
                            <Mail className="w-4 h-4 mr-3" />
                            <span className="text-sm">{site.contact_email}</span>
                          </div>
                        )}
                        
                        {site.contact_phone && (
                          <div className="flex items-center text-gray-600">
                            <Phone className="w-4 h-4 mr-3" />
                            <span className="text-sm">{site.contact_phone}</span>
                          </div>
                        )}
                        
                        {site.address && (
                          <div className="flex items-center text-gray-600">
                            <MapPin className="w-4 h-4 mr-3" />
                            <div className="text-sm">
                              <div>{site.address}</div>
                              {site.city && site.state && (
                                <div className="text-gray-500">{site.city}, {site.state} {site.zip_code}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {site.notes && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm text-gray-600">{site.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No sites added yet</h3>
                  <p className="text-gray-600 mb-4">Add sites to manage multiple locations for this commercial customer</p>
                  <button
                    onClick={() => {
                      resetSiteForm()
                      setEditingSite(null)
                      setShowSiteForm(true)
                    }}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add First Site
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Site Form Modal */}
      {showSiteForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingSite ? 'Edit Site' : 'Add New Site'}
              </h3>
            </div>
            
            <form onSubmit={handleSiteSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site Name *
                  </label>
                  <input
                    type="text"
                    value={siteFormData.site_name}
                    onChange={(e) => setSiteFormData({ ...siteFormData, site_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Main Office, Warehouse, Store #1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact First Name
                  </label>
                  <input
                    type="text"
                    value={siteFormData.contact_first_name}
                    onChange={(e) => setSiteFormData({ ...siteFormData, contact_first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Last Name
                  </label>
                  <input
                    type="text"
                    value={siteFormData.contact_last_name}
                    onChange={(e) => setSiteFormData({ ...siteFormData, contact_last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={siteFormData.contact_email}
                    onChange={(e) => setSiteFormData({ ...siteFormData, contact_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={siteFormData.contact_phone}
                    onChange={(e) => setSiteFormData({ ...siteFormData, contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={siteFormData.address}
                    onChange={(e) => setSiteFormData({ ...siteFormData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={siteFormData.city}
                    onChange={(e) => setSiteFormData({ ...siteFormData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    value={siteFormData.state}
                    onChange={(e) => setSiteFormData({ ...siteFormData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={siteFormData.zip_code}
                    onChange={(e) => setSiteFormData({ ...siteFormData, zip_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_primary"
                      checked={siteFormData.is_primary}
                      onChange={(e) => setSiteFormData({ ...siteFormData, is_primary: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_primary" className="ml-2 block text-sm text-gray-900">
                      Primary Site
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Mark this as the main location for this customer</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={siteFormData.notes}
                    onChange={(e) => setSiteFormData({ ...siteFormData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional notes about this site..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowSiteForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : (editingSite ? 'Update Site' : 'Add Site')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {showCustomerDetail && selectedCustomerForDetail && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedCustomerForDetail.customer_type === 'residential' 
                      ? `${selectedCustomerForDetail.first_name} ${selectedCustomerForDetail.last_name}`
                      : selectedCustomerForDetail.company_name
                    }
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Customer Details & Associated Records
                  </p>
                </div>
                <button
                  onClick={() => setShowCustomerDetail(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {detailLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Customer Information */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Type:</span>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            selectedCustomerForDetail.customer_type === 'commercial' 
                              ? 'text-blue-700 bg-blue-100' 
                              : 'text-green-700 bg-green-100'
                          }`}>
                            {selectedCustomerForDetail.customer_type === 'commercial' ? 'Commercial' : 'Residential'}
                          </span>
                        </div>
                        {selectedCustomerForDetail.email && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Email:</span>
                            <span className="text-sm text-gray-900">{selectedCustomerForDetail.email}</span>
                          </div>
                        )}
                        {selectedCustomerForDetail.phone && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Phone:</span>
                            <span className="text-sm text-gray-900">{selectedCustomerForDetail.phone}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {selectedCustomerForDetail.address && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Address:</span>
                            <span className="text-sm text-gray-900">{selectedCustomerForDetail.address}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Added:</span>
                          <span className="text-sm text-gray-900">
                            {new Date(selectedCustomerForDetail.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Work Orders */}
                  <div>
                    <div className="flex items-center mb-4">
                      <ClipboardList className="w-5 h-5 text-blue-600 mr-2" />
                      <h4 className="text-lg font-medium text-gray-900">Work Orders ({customerWorkOrders.length})</h4>
                    </div>
                    {customerWorkOrders.length > 0 ? (
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WO Number</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {customerWorkOrders.map((wo) => (
                                <tr 
                                  key={wo.id} 
                                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                                  onClick={() => handleRecordClick('work-order', wo.id)}
                                >
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{wo.wo_number}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900">{wo.title}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(wo.status)}`}>
                                      {wo.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {wo.assigned_technician ? 
                                      `${wo.assigned_technician.first_name} ${wo.assigned_technician.last_name}` : 
                                      'Unassigned'
                                    }
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {wo.customer_site?.site_name || 'Main Location'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {new Date(wo.created_at).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3">
                                    <ExternalLink className="w-4 h-4 text-gray-400" />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                        <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p>No work orders found for this customer</p>
                      </div>
                    )}
                  </div>

                  {/* Estimates */}
                  <div>
                    <div className="flex items-center mb-4">
                      <FileText className="w-5 h-5 text-purple-600 mr-2" />
                      <h4 className="text-lg font-medium text-gray-900">Estimates ({customerEstimates.length})</h4>
                    </div>
                    {customerEstimates.length > 0 ? (
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estimate #</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {customerEstimates.map((estimate) => (
                                <tr 
                                  key={estimate.id} 
                                  className="hover:bg-purple-50 cursor-pointer transition-colors"
                                  onClick={() => handleRecordClick('estimate', estimate.id)}
                                >
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{estimate.estimate_number}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900">{estimate.title}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(estimate.status)}`}>
                                      {estimate.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    ${estimate.total_amount.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {estimate.customer_site?.site_name || 'Main Location'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {new Date(estimate.created_at).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3">
                                    <ExternalLink className="w-4 h-4 text-gray-400" />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p>No estimates found for this customer</p>
                      </div>
                    )}
                  </div>

                  {/* Projects */}
                  <div>
                    <div className="flex items-center mb-4">
                      <FolderOpen className="w-5 h-5 text-green-600 mr-2" />
                      <h4 className="text-lg font-medium text-gray-900">Projects ({customerProjects.length})</h4>
                    </div>
                    {customerProjects.length > 0 ? (
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project #</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manager</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {customerProjects.map((project) => (
                                <tr 
                                  key={project.id} 
                                  className="hover:bg-green-50 cursor-pointer transition-colors"
                                  onClick={() => handleRecordClick('project', project.id)}
                                >
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{project.project_number}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900">{project.project_name}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
                                      {project.status.replace('_', ' ')}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    ${project.total_budget.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {project.project_manager_profile ? 
                                      `${project.project_manager_profile.first_name} ${project.project_manager_profile.last_name}` : 
                                      'Unassigned'
                                    }
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {project.customer_site?.site_name || 'Main Location'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {new Date(project.created_at).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3">
                                    <ExternalLink className="w-4 h-4 text-gray-400" />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p>No projects found for this customer</p>
                      </div>
                    )}
                  </div>

                  {/* Purchase Orders */}
                  <div>
                    <div className="flex items-center mb-4">
                      <ShoppingCart className="w-5 h-5 text-orange-600 mr-2" />
                      <h4 className="text-lg font-medium text-gray-900">Purchase Orders ({customerPurchaseOrders.length})</h4>
                    </div>
                    {customerPurchaseOrders.length > 0 ? (
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Work Order</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {customerPurchaseOrders.map((po) => (
                                <tr 
                                  key={po.id} 
                                  className="hover:bg-orange-50 cursor-pointer transition-colors"
                                  onClick={() => handleRecordClick('purchase-order', po.id)}
                                >
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{po.po_number}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900">{po.vendor?.name || 'No vendor'}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {po.work_order ? `${po.work_order.wo_number} - ${po.work_order.title}` : 'No work order'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(po.status)}`}>
                                      {po.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    ${po.total_amount.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {new Date(po.created_at).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3">
                                    <ExternalLink className="w-4 h-4 text-gray-400" />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p>No purchase orders found for this customer</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}