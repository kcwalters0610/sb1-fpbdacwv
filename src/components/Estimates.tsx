import React, { useState, useEffect } from 'react'
import { Plus, Search, FileText, Send, CheckCircle, XCircle, Clock, ArrowRight, Eye, Edit, Trash2, X, Mail } from 'lucide-react'
import { supabase, Estimate, Customer, CustomerSite } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'
import { getNextNumber, updateNextNumber } from '../lib/numbering'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

interface LineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
}

export default function Estimates() {
  const { viewType, setViewType } = useViewPreference('estimates')
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSites, setCustomerSites] = useState<CustomerSite[]>([])
  const [selectedSite, setSelectedSite] = useState<CustomerSite | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null)
  const [viewingEstimate, setViewingEstimate] = useState<Estimate | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [formData, setFormData] = useState({
    estimate_number: '',
    title: '',
    description: '',
    customer_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    status: 'draft',
    notes: '',
    tax_rate: '0',
    customer_site_id: ''
  })

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unit_price: 0, amount: 0 }
  ])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // Generate estimate number when form opens
    if (showForm && !editingEstimate) {
      generateEstimateNumber()
    }
  }, [showForm, editingEstimate])

  const generateEstimateNumber = async () => {
    try {
      const { formattedNumber: estimateNumber } = await getNextNumber('estimate')
      setFormData(prev => ({ ...prev, estimate_number: estimateNumber }))
    } catch (error) {
      console.error('Error generating estimate number:', error)
    }
  }

  useEffect(() => {
    // Generate estimate number when form opens
    if (showForm && !editingEstimate) {
      generateEstimateNumber()
    }
  }, [showForm, editingEstimate])

  const loadData = async () => {
    try {
      const [estimatesResult, customersResult] = await Promise.all([
        supabase
          .from('estimates')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('first_name')
      ])

      if (estimatesResult.error) throw estimatesResult.error
      
      // Load customer and site data separately to avoid foreign key issues
      const estimatesWithDetails = await Promise.all((estimatesResult.data || []).map(async (estimate) => {
        const [customerResult, siteResult] = await Promise.all([
          supabase
            .from('customers')
            .select('*')
            .eq('id', estimate.customer_id)
            .single(),
          estimate.customer_site_id ? 
            supabase
              .from('customer_sites')
              .select('*')
              .eq('id', estimate.customer_site_id)
              .single() : 
            Promise.resolve({ data: null, error: null })
        ])
        
        return {
          ...estimate,
          customer: customerResult.data,
          customer_site: siteResult.data
        }
      }))
      
      setEstimates(estimatesWithDetails)
      setCustomers(customersResult.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
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

  const addLineItem = () => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unit_price: 0,
      amount: 0
    }
    setLineItems([...lineItems, newItem])
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(items => items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value }
        if (field === 'quantity' || field === 'unit_price') {
          updatedItem.amount = updatedItem.quantity * updatedItem.unit_price
        }
        return updatedItem
      }
      return item
    }))
  }

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(items => items.filter(item => item.id !== id))
    }
  }

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
    const taxRate = parseFloat(formData.tax_rate) || 0
    const taxAmount = (subtotal * taxRate) / 100
    const total = subtotal + taxAmount

    return { subtotal, taxAmount, total }
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

      const { subtotal, taxAmount, total } = calculateTotals()

      const estimateData = {
        company_id: profile.company_id,
        estimate_number: formData.estimate_number,
        title: formData.title,
        description: formData.description,
        customer_id: formData.customer_id,
        issue_date: formData.issue_date,
        expiry_date: formData.expiry_date || null,
        status: formData.status,
        subtotal,
        tax_rate: parseFloat(formData.tax_rate) || 0,
        tax_amount: taxAmount,
        total_amount: total,
        notes: formData.notes,
        customer_site_id: formData.customer_site_id || null,
        settings: {
          line_items: lineItems
        }
      }

      if (editingEstimate) {
        const { error } = await supabase
          .from('estimates')
          .update(estimateData)
          .eq('id', editingEstimate.id)
        if (error) throw error
      } else {
        const { formattedNumber: estimateNumber, nextSequence } = await getNextNumber('estimate')
        estimateData.estimate_number = estimateNumber
        
        const { error } = await supabase
          .from('estimates')
          .insert([estimateData])
        if (error) throw error
        
        // Update the sequence number
        await updateNextNumber('estimate', nextSequence)
      }

      setShowForm(false)
      setEditingEstimate(null)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving estimate:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      estimate_number: '',
      title: '',
      description: '',
      customer_id: '',
      issue_date: new Date().toISOString().split('T')[0],
      expiry_date: '',
      status: 'draft',
      notes: '',
      tax_rate: '0',
      customer_site_id: ''
    })
    setLineItems([
      { id: '1', description: '', quantity: 1, unit_price: 0, amount: 0 }
    ])
    setCustomerSites([])
    setSelectedSite(null)
  }

  const startEdit = (estimate: Estimate) => {
    setEditingEstimate(estimate)
    setFormData({
      estimate_number: estimate.estimate_number,
      title: estimate.title,
      description: estimate.description || '',
      customer_id: estimate.customer_id,
      issue_date: estimate.issue_date,
      expiry_date: estimate.expiry_date || '',
      status: estimate.status,
      notes: estimate.notes || '',
      tax_rate: estimate.tax_rate.toString(),
      customer_site_id: estimate.customer_site_id || ''
    })

    // Load customer sites if customer is selected
    if (estimate.customer_id) {
      loadCustomerSites(estimate.customer_id)
      
      // Set selected site if estimate has one
      if (estimate.customer_site_id && estimate.customer_site) {
        setSelectedSite(estimate.customer_site)
      }
    }

    // Load line items from settings
    if (estimate.settings?.line_items) {
      setLineItems(estimate.settings.line_items)
    } else {
      setLineItems([
        { id: '1', description: '', quantity: 1, unit_price: 0, amount: 0 }
      ])
    }
    setShowForm(true)
  }

  const viewEstimateDetails = (estimate: Estimate) => {
    setViewingEstimate(estimate)
  }

  const deleteEstimate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this estimate?')) return

    try {
      const { error } = await supabase
        .from('estimates')
        .delete()
        .eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting estimate:', error)
    }
  }

  const convertToProject = async (estimate: Estimate) => {
    if (!confirm('Convert this estimate to a project? This will mark the estimate as converted.')) return

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

      
      if (!projectNumber) {
        throw new Error('Failed to generate project number')
      }
      // Create project from estimate
      const projectData = {
        company_id: profile.company_id,
        project_name: estimate.title,
        description: estimate.description,
        customer_id: estimate.customer_id,
        customer_site_id: estimate.customer_site_id,
        total_budget: estimate.total_amount,
        estimate_id: estimate.id,
        status: 'planning',
        priority: 'medium'
      }

      const { error: projectError } = await supabase
        .from('projects')
        .insert([projectData])

      if (projectError) throw projectError

      // Update estimate status to converted
      const { error: estimateError } = await supabase
        .from('estimates')
        .update({ status: 'converted' })
        .eq('id', estimate.id)

      if (estimateError) throw estimateError

      alert('Estimate successfully converted to project!')
      loadData()
    } catch (error) {
      console.error('Error converting estimate to project:', error)
      alert('Error converting estimate to project')
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('estimates')
        .update({ status })
        .eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const generatePDF = (estimate: Estimate) => {
    try {
      const doc = new jsPDF();
      
      // Add company header
      doc.setFontSize(20);
      doc.setTextColor(0, 68, 108); // Dark blue color
      doc.text("FolioOps", 14, 22);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text("Field Service Management", 14, 30);
      
      // Add estimate details
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text(`ESTIMATE #${estimate.estimate_number}`, 14, 45);
      
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Date: ${new Date(estimate.issue_date).toLocaleDateString()}`, 14, 55);
      
      if (estimate.expiry_date) {
        doc.text(`Valid until: ${new Date(estimate.expiry_date).toLocaleDateString()}`, 14, 62);
      }
      
      // Add customer info
      if (estimate.customer) {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("Customer:", 14, 75);
        
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        const customerName = estimate.customer.customer_type === 'residential' 
          ? `${estimate.customer.first_name} ${estimate.customer.last_name}`
          : estimate.customer.company_name;
        doc.text(customerName, 14, 82);
        
        if (estimate.customer.email) {
          doc.text(estimate.customer.email, 14, 89);
        }
        
        if (estimate.customer.phone) {
          doc.text(estimate.customer.phone, 14, 96);
        }
      }
      
      // Add estimate title and description
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(estimate.title, 14, 115);
      
      if (estimate.description) {
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text(estimate.description, 14, 125);
      }
      
      // Add line items table
      if (estimate.settings?.line_items && estimate.settings.line_items.length > 0) {
        const tableData = estimate.settings.line_items.map((item: any) => [
          item.description,
          item.quantity,
          `$${item.unit_price.toFixed(2)}`,
          `$${item.amount.toFixed(2)}`
        ]);
        
        doc.autoTable({
          startY: 140,
          head: [['Description', 'Quantity', 'Unit Price', 'Amount']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [0, 68, 108] },
          margin: { top: 140 }
        });
        
        // Add totals after the table
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        
        doc.setFontSize(10);
        doc.text(`Subtotal:`, 140, finalY);
        doc.text(`$${estimate.subtotal.toFixed(2)}`, 180, finalY, { align: 'right' });
        
        doc.text(`Tax (${estimate.tax_rate}%):`, 140, finalY + 7);
        doc.text(`$${estimate.tax_amount.toFixed(2)}`, 180, finalY + 7, { align: 'right' });
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Total:`, 140, finalY + 17);
        doc.text(`$${estimate.total_amount.toFixed(2)}`, 180, finalY + 17, { align: 'right' });
      }
      
      // Add notes if available
      if (estimate.notes) {
        const notesY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 30 : 200;
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text("Notes:", 14, notesY);
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(estimate.notes, 14, notesY + 7);
      }
      
      return doc;
    } catch (error) {
      console.error('Error generating PDF:', error);
      return null;
    }
  }

  const sendEstimateEmail = (estimate: Estimate) => {
    try {
      // Generate PDF
      const doc = generatePDF(estimate);
      if (!doc) {
        alert('Error generating PDF');
        return;
      }
      
      // In a real app, you would send this to a server endpoint or use a service
      // For now, we'll just download the PDF and open an email client
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Create a download link for the PDF
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = `Estimate_${estimate.estimate_number}.pdf`;
      a.click();
      
      // Prepare email content
      const customerName = estimate.customer?.customer_type === 'residential' 
        ? `${estimate.customer?.first_name} ${estimate.customer?.last_name}`
        : estimate.customer?.company_name;
      
      const subject = `Estimate ${estimate.estimate_number} - ${estimate.title}`;
      const body = `Dear ${customerName},\n\nPlease find attached our estimate ${estimate.estimate_number} for ${estimate.title}.\n\nThank you for your business.\n\nBest regards,\nYour Company`;
      
      // Open email client
      const mailtoLink = `mailto:${estimate.customer?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoLink);
      
      // Update estimate status to 'sent'
      updateStatus(estimate.id, 'sent');
      
    } catch (error) {
      console.error('Error sending estimate:', error);
      alert('Error sending estimate');
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-700 bg-green-100'
      case 'sent': return 'text-blue-700 bg-blue-100'
      case 'converted': return 'text-purple-700 bg-purple-100'
      case 'rejected': return 'text-red-700 bg-red-100'
      case 'expired': return 'text-gray-700 bg-gray-100'
      case 'draft': return 'text-yellow-700 bg-yellow-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  const filteredEstimates = estimates.filter(estimate => {
    const matchesSearch = estimate.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         estimate.estimate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         `${estimate.customer?.first_name} ${estimate.customer?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !statusFilter || estimate.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const { subtotal, taxAmount, total } = calculateTotals()

  if (loading && estimates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
        <button
          onClick={() => {
            resetForm()
            setEditingEstimate(null)
            setShowForm(true)
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Estimate
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search estimates..."
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
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
            <option value="converted">Converted</option>
          </select>
          <div className="flex justify-end">
            <ViewToggle viewType={viewType} onViewChange={setViewType} />
          </div>
        </div>
      </div>

      {/* Estimates Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {viewType === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estimate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issue Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEstimates.map((estimate) => (
                  <tr key={estimate.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{estimate.estimate_number}</div>
                        <div className="text-sm text-gray-500">{estimate.title}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {estimate.customer?.customer_type === 'residential' 
                          ? `${estimate.customer?.first_name} ${estimate.customer?.last_name}`
                          : estimate.customer?.company_name
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${estimate.total_amount.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(estimate.status)}`}>
                        {estimate.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(estimate.issue_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {estimate.status === 'approved' && (
                          <button
                            onClick={() => convertToProject(estimate)}
                            className="text-purple-600 hover:text-purple-900"
                            title="Convert to Project"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => viewEstimateDetails(estimate)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => sendEstimateEmail(estimate)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Send"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEdit(estimate)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteEstimate(estimate.id)}
                          className="text-red-600 hover:text-red-900"
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
              {filteredEstimates.map((estimate) => (
                <div key={estimate.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{estimate.estimate_number}</h3>
                      <p className="text-sm text-gray-600 mb-2">{estimate.title}</p>
                      <p className="text-lg font-bold text-green-600">${estimate.total_amount.toFixed(2)}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(estimate.status)}`}>
                      {estimate.status}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Customer:</span> {estimate.customer?.customer_type === 'residential' 
                        ? `${estimate.customer?.first_name} ${estimate.customer?.last_name}`
                        : estimate.customer?.company_name
                      }
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Issue Date:</span> {new Date(estimate.issue_date).toLocaleDateString()}
                    </div>
                    {estimate.expiry_date && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Expires:</span> {new Date(estimate.expiry_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="flex space-x-2">
                      {estimate.status === 'approved' && (
                        <button
                          onClick={() => convertToProject(estimate)}
                          className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors text-sm"
                        >
                          <ArrowRight className="w-4 h-4 mr-1" />
                          Convert
                        </button>
                      )}
                      <button
                        onClick={() => viewEstimateDetails(estimate)}
                        className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </button>
                      <button
                        onClick={() => sendEstimateEmail(estimate)}
                        className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
                      >
                        <Mail className="w-4 h-4 mr-1" />
                        Send
                      </button>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEdit(estimate)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteEstimate(estimate.id)}
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
      </div>

      {/* Modals */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingEstimate ? 'Edit Estimate' : 'Create New Estimate'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Header Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimate Number
                  </label>
                  <input
                    type="text"
                    value={formData.estimate_number}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
                    readOnly
                    readOnly
                  />
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
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., HVAC System Installation"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer *
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => {
                      const customerId = e.target.value
                      setFormData({ ...formData, customer_id: customerId, customer_site_id: '' })
                      setSelectedSite(null)
                      if (customerId) {
                        loadCustomerSites(customerId)
                      } else {
                        setCustomerSites([])
                      }
                    }}
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

                {/* Customer Site Selection */}
                {formData.customer_id && customerSites.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Site
                    </label>
                    <select
                      value={formData.customer_site_id}
                      onChange={(e) => {
                        const siteId = e.target.value
                        setFormData({ ...formData, customer_site_id: siteId })
                        
                        if (siteId && siteId !== 'main') {
                          const site = customerSites.find(s => s.id === siteId)
                          setSelectedSite(site || null)
                        } else {
                          setSelectedSite(null)
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Site</option>
                      <option value="main">Main Location</option>
                      {customerSites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.site_name}
                          {site.is_primary && ' (Primary)'}
                          {site.address && ` - ${site.address}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Selected Site Information */}
                {selectedSite && (
                  <div className="md:col-span-2">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                        {selectedSite.site_name}
                        {selectedSite.is_primary && (
                          <span className="ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                            Primary Site
                          </span>
                        )}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                        {(selectedSite.contact_first_name || selectedSite.contact_last_name) && (
                          <div>
                            <span className="font-medium">Contact:</span> {selectedSite.contact_first_name} {selectedSite.contact_last_name}
                          </div>
                        )}
                        {selectedSite.contact_phone && (
                          <div>
                            <span className="font-medium">Phone:</span> {selectedSite.contact_phone}
                          </div>
                        )}
                        {selectedSite.contact_email && (
                          <div>
                            <span className="font-medium">Email:</span> {selectedSite.contact_email}
                          </div>
                        )}
                        {selectedSite.address && (
                          <div className="md:col-span-2">
                            <span className="font-medium">Address:</span> {selectedSite.address}
                            {selectedSite.city && selectedSite.state && `, ${selectedSite.city}, ${selectedSite.state} ${selectedSite.zip_code || ''}`}
                          </div>
                        )}
                        {selectedSite.notes && (
                          <div className="md:col-span-2">
                            <span className="font-medium">Notes:</span> {selectedSite.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Issue Date *
                  </label>
                  <input
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="mm/dd/yyyy"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Detailed description of the work to be performed..."
                />
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-gray-900">Line Items</h4>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Item
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                          Unit Price
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {lineItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Item description"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              ${item.amount.toFixed(2)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => removeLineItem(item.id)}
                              className="text-red-600 hover:text-red-800"
                              disabled={lineItems.length === 1}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes and Totals */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional notes or terms..."
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Subtotal</span>
                    <span className="text-lg font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-700">Tax Rate</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.tax_rate}
                        onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                        className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                    <span className="text-lg font-semibold text-gray-900">${taxAmount.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <span className="text-lg font-bold text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-blue-600">${total.toFixed(2)}</span>
                  </div>
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
                  {loading ? 'Saving...' : 'Save Estimate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Estimate Details Modal */}
      {viewingEstimate && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  Estimate Details: {viewingEstimate.estimate_number}
                </h3>
                <button
                  onClick={() => setViewingEstimate(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Header Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-md font-medium text-gray-700 mb-3">Estimate Information</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Title:</span>
                      <p className="text-sm text-gray-900">{viewingEstimate.title}</p>
                    </div>
                    {viewingEstimate.description && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">Description:</span>
                        <p className="text-sm text-gray-900">{viewingEstimate.description}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-medium text-gray-600">Status:</span>
                      <span className={`inline-flex ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(viewingEstimate.status)}`}>
                        {viewingEstimate.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Issue Date:</span>
                      <p className="text-sm text-gray-900">{new Date(viewingEstimate.issue_date).toLocaleDateString()}</p>
                    </div>
                    {viewingEstimate.expiry_date && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">Expiry Date:</span>
                        <p className="text-sm text-gray-900">{new Date(viewingEstimate.expiry_date).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-md font-medium text-gray-700 mb-3">Customer Information</h4>
                  <div className="space-y-2">
                    {viewingEstimate.customer && (
                      <>
                        <div>
                          <span className="text-sm font-medium text-gray-600">Customer:</span>
                          <p className="text-sm text-gray-900">
                            {viewingEstimate.customer.customer_type === 'residential' 
                              ? `${viewingEstimate.customer.first_name} ${viewingEstimate.customer.last_name}`
                              : viewingEstimate.customer.company_name
                            }
                          </p>
                        </div>
                        {viewingEstimate.customer.email && (
                          <div>
                            <span className="text-sm font-medium text-gray-600">Email:</span>
                            <p className="text-sm text-gray-900">{viewingEstimate.customer.email}</p>
                          </div>
                        )}
                        {viewingEstimate.customer.phone && (
                          <div>
                            <span className="text-sm font-medium text-gray-600">Phone:</span>
                            <p className="text-sm text-gray-900">{viewingEstimate.customer.phone}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Line Items */}
              <div>
                <h4 className="text-md font-medium text-gray-700 mb-3">Line Items</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                          Unit Price
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {viewingEstimate.settings?.line_items ? (
                        viewingEstimate.settings.line_items.map((item: any, index: number) => (
                          <tr key={index}>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">${item.unit_price.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">${item.amount.toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-sm text-gray-500 text-center">No line items available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Totals and Notes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {viewingEstimate.notes && (
                  <div>
                    <h4 className="text-md font-medium text-gray-700 mb-3">Notes</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-900">{viewingEstimate.notes}</p>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-700 mb-3">Summary</h4>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Subtotal</span>
                      <span className="text-sm font-medium text-gray-900">${viewingEstimate.subtotal.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Tax ({viewingEstimate.tax_rate}%)</span>
                      <span className="text-sm font-medium text-gray-900">${viewingEstimate.tax_amount.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-sm font-bold text-gray-900">Total</span>
                      <span className="text-lg font-bold text-blue-600">${viewingEstimate.total_amount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setViewingEstimate(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    sendEstimateEmail(viewingEstimate);
                    setViewingEstimate(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Send Estimate
                </button>
                {viewingEstimate.status === 'approved' && (
                  <button
                    onClick={() => {
                      convertToProject(viewingEstimate);
                      setViewingEstimate(null);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Convert to Project
                  </button>
                )}
                <button
                  onClick={() => {
                    startEdit(viewingEstimate);
                    setViewingEstimate(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit Estimate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}