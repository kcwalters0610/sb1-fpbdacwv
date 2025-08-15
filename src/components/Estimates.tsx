import React, { useState, useEffect } from 'react'
import { Plus, Search, Calendar, User, DollarSign, Edit, Trash2, Eye, X, Building2, FileText, Download } from 'lucide-react'
import { supabase, Estimate, Customer, CustomerSite } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'
import { getNextNumber, updateNextNumber } from '../lib/numbering'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'


export default function Estimates() {
  const { viewType, setViewType } = useViewPreference('estimates')
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSites, setCustomerSites] = useState<CustomerSite[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null)
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loadingSites, setLoadingSites] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [companyInfo, setCompanyInfo] = useState<any>(null)

  const [formData, setFormData] = useState({
    estimate_number: '',
    customer_id: '',
    customer_site_id: '',
    title: '',
    description: '',
    status: 'draft',
    issue_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    subtotal: '',
    tax_rate: '0',
    notes: ''
  })

  useEffect(() => {
    loadData()
    loadCompanyInfo()
  }, [])

  useEffect(() => {
    // Generate estimate number when form opens
    if (showForm && !editingEstimate) {
      generateEstimateNumber()
    }
  }, [showForm, editingEstimate])

  useEffect(() => {
    // Load customer sites when customer changes
    if (formData.customer_id) {
      loadCustomerSites(formData.customer_id)
    } else {
      setCustomerSites([])
      setFormData(prev => ({ ...prev, customer_site_id: '' }))
    }
  }, [formData.customer_id])

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

  const generateEstimateNumber = async () => {
    try {
      const { formattedNumber: estimateNumber } = await getNextNumber('estimate')
      setFormData(prev => ({ ...prev, estimate_number: estimateNumber }))
    } catch (error) {
      console.error('Error generating estimate number:', error)
    }
  }

  const loadData = async () => {
    try {
      const [estimatesResult, customersResult] = await Promise.all([
        supabase
          .from('estimates')
          .select(`
            *,
            customer:customers(*),
            customer_site:customer_sites(*)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('first_name')
      ])

      setEstimates(estimatesResult.data || [])
      setCustomers(customersResult.data || [])
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

      const subtotal = parseFloat(formData.subtotal) || 0
      const taxRate = parseFloat(formData.tax_rate) || 0
      const taxAmount = (subtotal * taxRate) / 100
      const totalAmount = subtotal + taxAmount

      const estimateData = {
        company_id: profile.company_id,
        customer_id: formData.customer_id,
        customer_site_id: formData.customer_site_id || null,
        estimate_number: formData.estimate_number,
        title: formData.title,
        description: formData.description || null,
        status: formData.status,
        issue_date: formData.issue_date,
        expiry_date: formData.expiry_date || null,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: formData.notes || null
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
      alert('Error saving estimate: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      estimate_number: '',
      customer_id: '',
      customer_site_id: '',
      title: '',
      description: '',
      status: 'draft',
      issue_date: new Date().toISOString().split('T')[0],
      expiry_date: '',
      subtotal: '',
      tax_rate: '0',
      notes: ''
    })
    setCustomerSites([])
  }

  const startEdit = (estimate: Estimate) => {
    setEditingEstimate(estimate)
    setFormData({
      estimate_number: estimate.estimate_number,
      customer_id: estimate.customer_id,
      customer_site_id: estimate.customer_site_id || '',
      title: estimate.title,
      description: estimate.description || '',
      status: estimate.status,
      issue_date: estimate.issue_date,
      expiry_date: estimate.expiry_date || '',
      subtotal: estimate.subtotal.toString(),
      tax_rate: estimate.tax_rate.toString(),
      notes: estimate.notes || ''
    })
    
    // Load customer sites for the selected customer
    if (estimate.customer_id) {
      loadCustomerSites(estimate.customer_id)
    }
    
    setShowForm(true)
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

  const generateEstimatePDF = async (estimate: Estimate) => {
    setGeneratingPDF(true)
    try {
      // Initialize PDF
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      let yPosition = 20

      // Company Header
      if (companyInfo?.settings?.logo_url) {
        try {
          // Add company logo
          const img = new Image()
          img.crossOrigin = 'anonymous'
          
          await new Promise((resolve, reject) => {
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas')
                canvas.width = img.width
                canvas.height = img.height
                const ctx = canvas.getContext('2d')
                if (ctx) {
                  ctx.drawImage(img, 0, 0)
                  const dataURL = canvas.toDataURL('image/png')
                  const aspectRatio = img.width / img.height
                  const logoHeight = 15
                  const logoWidth = logoHeight * aspectRatio
                  doc.addImage(dataURL, 'PNG', 20, yPosition, logoWidth, logoHeight)
                }
                resolve(true)
              } catch (err) {
                reject(err)
              }
            }
            img.onerror = reject
            img.src = companyInfo.settings.logo_url
          })
        } catch (error) {
          console.warn('Could not load company logo:', error)
        }
      }

      // Company name and info
      doc.setFontSize(20)
      doc.setTextColor(0, 68, 108)
      doc.text(companyInfo?.name || 'Company Name', 20, yPosition + 25)
      
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      if (companyInfo?.address) {
        doc.text(companyInfo.address, 20, yPosition + 32)
      }
      if (companyInfo?.city && companyInfo?.state) {
        doc.text(`${companyInfo.city}, ${companyInfo.state} ${companyInfo.zip_code || ''}`, 20, yPosition + 37)
      }
      if (companyInfo?.phone) {
        doc.text(`Phone: ${companyInfo.phone}`, 20, yPosition + 42)
      }
      if (companyInfo?.email) {
        doc.text(`Email: ${companyInfo.email}`, 20, yPosition + 47)
      }

      yPosition += 60

      // Estimate title
      doc.setFontSize(24)
      doc.setTextColor(0, 0, 0)
      doc.text('ESTIMATE', doc.internal.pageSize.width / 2, yPosition, { align: 'center' })
      
      yPosition += 20

      // Estimate details
      doc.setFontSize(12)
      doc.setTextColor(0, 0, 0)
      doc.text(`Estimate #: ${estimate.estimate_number}`, 20, yPosition)
      doc.text(`Date: ${new Date(estimate.issue_date).toLocaleDateString()}`, 120, yPosition)
      
      yPosition += 10
      
      if (estimate.expiry_date) {
        doc.text(`Valid Until: ${new Date(estimate.expiry_date).toLocaleDateString()}`, 120, yPosition)
        yPosition += 10
      }

      yPosition += 10

      // Customer information
      doc.setFontSize(14)
      doc.setTextColor(0, 68, 108)
      doc.text('Bill To:', 20, yPosition)
      
      yPosition += 8
      doc.setFontSize(11)
      doc.setTextColor(0, 0, 0)
      
      if (estimate.customer) {
        const customerName = estimate.customer.customer_type === 'residential' 
          ? `${estimate.customer.first_name} ${estimate.customer.last_name}`
          : estimate.customer.company_name
        
        doc.text(customerName, 20, yPosition)
        yPosition += 6
        
        if (estimate.customer.customer_type === 'commercial' && estimate.customer.first_name) {
          doc.text(`Attn: ${estimate.customer.first_name} ${estimate.customer.last_name}`, 20, yPosition)
          yPosition += 6
        }
        
        if (estimate.customer.address) {
          doc.text(estimate.customer.address, 20, yPosition)
          yPosition += 6
        }
        
        if (estimate.customer.city && estimate.customer.state) {
          doc.text(`${estimate.customer.city}, ${estimate.customer.state} ${estimate.customer.zip_code || ''}`, 20, yPosition)
          yPosition += 6
        }
        
        if (estimate.customer.phone) {
          doc.text(`Phone: ${estimate.customer.phone}`, 20, yPosition)
          yPosition += 6
        }
        
        if (estimate.customer.email) {
          doc.text(`Email: ${estimate.customer.email}`, 20, yPosition)
          yPosition += 6
        }
      }

      // Customer site information if applicable
      if (estimate.customer_site) {
        yPosition += 5
        doc.setFontSize(12)
        doc.setTextColor(0, 68, 108)
        doc.text('Service Location:', 20, yPosition)
        
        yPosition += 6
        doc.setFontSize(11)
        doc.setTextColor(0, 0, 0)
        doc.text(estimate.customer_site.site_name, 20, yPosition)
        yPosition += 6
        
        if (estimate.customer_site.address) {
          doc.text(estimate.customer_site.address, 20, yPosition)
          yPosition += 6
        }
        
        if (estimate.customer_site.city && estimate.customer_site.state) {
          doc.text(`${estimate.customer_site.city}, ${estimate.customer_site.state} ${estimate.customer_site.zip_code || ''}`, 20, yPosition)
          yPosition += 6
        }
      }

      yPosition += 15

      // Estimate title and description
      doc.setFontSize(14)
      doc.setTextColor(0, 68, 108)
      doc.text('Project Details:', 20, yPosition)
      
      yPosition += 8
      doc.setFontSize(12)
      doc.setTextColor(0, 0, 0)
      doc.text(`Title: ${estimate.title}`, 20, yPosition)
      
      if (estimate.description) {
        yPosition += 8
        const splitDescription = doc.splitTextToSize(estimate.description, 170)
        doc.text(splitDescription, 20, yPosition)
        yPosition += splitDescription.length * 5
      }

      yPosition += 15

      // Financial summary
      doc.setFontSize(14)
      doc.setTextColor(0, 68, 108)
      doc.text('Estimate Summary:', 20, yPosition)
      
      yPosition += 10
      
      // Create a simple table for the financial breakdown
      const tableData = [
        ['Description', 'Amount'],
        ['Subtotal', `$${estimate.subtotal.toFixed(2)}`],
        ['Tax (' + estimate.tax_rate + '%)', `$${estimate.tax_amount.toFixed(2)}`],
        ['Total', `$${estimate.total_amount.toFixed(2)}`]
      ]

      doc.autoTable({
        startY: yPosition,
        head: [tableData[0]],
        body: tableData.slice(1),
        theme: 'grid',
        headStyles: { 
          fillColor: [0, 68, 108],
          textColor: 255,
          fontStyle: 'bold'
        },
        styles: { 
          fontSize: 11,
          cellPadding: 5
        },
        columnStyles: {
          0: { cellWidth: 140 },
          1: { cellWidth: 40, halign: 'right' }
        }
      })

      yPosition = doc.lastAutoTable.finalY + 20

      // Notes section
      if (estimate.notes) {
        doc.setFontSize(12)
        doc.setTextColor(0, 68, 108)
        doc.text('Notes:', 20, yPosition)
        
        yPosition += 8
        doc.setFontSize(10)
        doc.setTextColor(0, 0, 0)
        const splitNotes = doc.splitTextToSize(estimate.notes, 170)
        doc.text(splitNotes, 20, yPosition)
        yPosition += splitNotes.length * 4 + 10
      }

      // Terms and conditions
      yPosition += 10
      doc.setFontSize(12)
      doc.setTextColor(0, 68, 108)
      doc.text('Terms & Conditions:', 20, yPosition)
      
      yPosition += 8
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
      const terms = [
        '• This estimate is valid for 30 days from the date of issue.',
        '• Prices are subject to change without notice.',
        '• Work will commence upon signed approval and required deposit.',
        '• Additional work not covered in this estimate will be charged separately.',
        '• Payment terms: Net 30 days from completion.'
      ]
      
      terms.forEach(term => {
        doc.text(term, 20, yPosition)
        yPosition += 5
      })

      // Signature section
      yPosition += 20
      
      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }
      
      doc.setFontSize(12)
      doc.setTextColor(0, 68, 108)
      doc.text('Customer Approval:', 20, yPosition)
      
      yPosition += 15
      
      // Signature line
      doc.setLineWidth(0.5)
      doc.setDrawColor(0, 0, 0)
      doc.line(20, yPosition, 100, yPosition)
      
      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      doc.text('Customer Signature', 20, yPosition + 5)
      
      // Date line
      doc.line(120, yPosition, 180, yPosition)
      doc.text('Date', 120, yPosition + 5)
      
      yPosition += 20
      
      // Print name line
      doc.line(20, yPosition, 100, yPosition)
      doc.text('Print Name', 20, yPosition + 5)
      
      // Company representative signature
      yPosition += 25
      doc.setFontSize(12)
      doc.setTextColor(0, 68, 108)
      doc.text('Company Representative:', 20, yPosition)
      
      yPosition += 15
      doc.line(20, yPosition, 100, yPosition)
      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      doc.text('Authorized Signature', 20, yPosition + 5)
      
      doc.line(120, yPosition, 180, yPosition)
      doc.text('Date', 120, yPosition + 5)

      // Footer
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(
        `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )

      // Save the PDF
      const fileName = `Estimate_${estimate.estimate_number}_${estimate.customer?.customer_type === 'residential' 
        ? `${estimate.customer?.first_name}_${estimate.customer?.last_name}`
        : estimate.customer?.company_name?.replace(/\s+/g, '_')
      }.pdf`
      
      doc.save(fileName)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try again.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-700 bg-green-100'
      case 'sent': return 'text-blue-700 bg-blue-100'
      case 'rejected': return 'text-red-700 bg-red-100'
      case 'expired': return 'text-gray-700 bg-gray-100'
      case 'converted': return 'text-purple-700 bg-purple-100'
      case 'draft': return 'text-yellow-700 bg-yellow-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  const filteredEstimates = estimates.filter(estimate => {
    const matchesSearch = estimate.estimate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         estimate.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (estimate.customer?.customer_type === 'residential' 
                           ? `${estimate.customer?.first_name} ${estimate.customer?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
                           : estimate.customer?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
                         )
    const matchesStatus = !statusFilter || estimate.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalValue = estimates.reduce((sum, estimate) => sum + estimate.total_amount, 0)
  const approvedValue = estimates.filter(est => est.status === 'approved').reduce((sum, estimate) => sum + estimate.total_amount, 0)
  const pendingValue = estimates.filter(est => est.status === 'sent').reduce((sum, estimate) => sum + estimate.total_amount, 0)

  if (loading && estimates.length === 0) {
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
          Create Estimate
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <FileText className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">${totalValue.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <DollarSign className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Approved Value</p>
              <p className="text-2xl font-bold text-gray-900">${approvedValue.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <Calendar className="w-8 h-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Value</p>
              <p className="text-2xl font-bold text-gray-900">${pendingValue.toFixed(2)}</p>
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
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                      <div className="text-sm font-medium text-gray-900">{estimate.estimate_number}</div>
                      <div className="text-sm text-gray-500">{estimate.title}</div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {estimate.customer?.customer_type === 'residential' 
                          ? `${estimate.customer?.first_name} ${estimate.customer?.last_name}`
                          : estimate.customer?.company_name
                        }
                      </div>
                      {estimate.customer_site && (
                        <div className="text-xs text-gray-500">{estimate.customer_site.site_name}</div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${estimate.total_amount.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={estimate.status}
                        onChange={(e) => updateStatus(estimate.id, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${getStatusColor(estimate.status)}`}
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="expired">Expired</option>
                        <option value="converted">Converted</option>
                      </select>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(estimate.issue_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => generateEstimatePDF(estimate)}
                          disabled={generatingPDF}
                          className="text-green-600 hover:text-green-800 p-1.5 transition-all duration-200 hover:bg-green-100 rounded-full hover:shadow-sm transform hover:scale-110"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedEstimate(estimate)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEdit(estimate)}
                          className="text-blue-600 hover:text-blue-900 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteEstimate(estimate.id)}
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
              {filteredEstimates.map((estimate) => (
                <div key={estimate.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{estimate.estimate_number}</h3>
                      <p className="text-sm text-gray-600 mb-2">{estimate.title}</p>
                      <p className="text-2xl font-bold text-green-600 mb-2">${estimate.total_amount.toFixed(2)}</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(estimate.status)}`}>
                        {estimate.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Building2 className="w-4 h-4 mr-3" />
                      <span>
                        {estimate.customer?.customer_type === 'residential' 
                          ? `${estimate.customer?.first_name} ${estimate.customer?.last_name}`
                          : estimate.customer?.company_name
                        }
                      </span>
                    </div>
                    
                    {estimate.customer_site && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Building2 className="w-4 h-4 mr-3" />
                        <span>{estimate.customer_site.site_name}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-3" />
                      <span>Issued: {new Date(estimate.issue_date).toLocaleDateString()}</span>
                    </div>
                    
                    {estimate.expiry_date && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-3" />
                        <span>Expires: {new Date(estimate.expiry_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      {estimate.description && estimate.description.substring(0, 30)}
                      {estimate.description && estimate.description.length > 30 && '...'}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => generateEstimatePDF(estimate)}
                        disabled={generatingPDF}
                        className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        PDF
                      </button>
                      <button
                        onClick={() => setSelectedEstimate(estimate)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View
                      </button>
                      <button
                        onClick={() => startEdit(estimate)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
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
                {editingEstimate ? 'Edit Estimate' : 'Create New Estimate'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
                    <option value="converted">Converted</option>
                  </select>
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
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subtotal *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.subtotal}
                    onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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

              {/* Totals Preview */}
              {formData.subtotal && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Subtotal:</span>
                      <span className="text-sm text-gray-900">${parseFloat(formData.subtotal || '0').toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Tax ({formData.tax_rate}%):</span>
                      <span className="text-sm text-gray-900">
                        ${((parseFloat(formData.subtotal || '0') * parseFloat(formData.tax_rate || '0')) / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-lg font-bold text-gray-900">Total:</span>
                      <span className="text-lg font-bold text-blue-600">
                        ${(parseFloat(formData.subtotal || '0') + ((parseFloat(formData.subtotal || '0') * parseFloat(formData.tax_rate || '0')) / 100)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
                  {loading ? 'Saving...' : (editingEstimate ? 'Update Estimate' : 'Create Estimate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Estimate Detail Modal */}
      {selectedEstimate && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  Estimate {selectedEstimate.estimate_number}
                </h3>
                <button
                  onClick={() => setSelectedEstimate(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Estimate Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Title:</span>
                      <span className="text-sm text-gray-900">{selectedEstimate.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Status:</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedEstimate.status)}`}>
                        {selectedEstimate.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Issue Date:</span>
                      <span className="text-sm text-gray-900">{new Date(selectedEstimate.issue_date).toLocaleDateString()}</span>
                    </div>
                    {selectedEstimate.expiry_date && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Expiry Date:</span>
                        <span className="text-sm text-gray-900">{new Date(selectedEstimate.expiry_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {selectedEstimate.description && (
                    <div className="mt-6">
                      <h5 className="text-md font-medium text-gray-900 mb-3">Description</h5>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700">{selectedEstimate.description}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Customer:</span>
                      <span className="text-sm text-gray-900">
                        {selectedEstimate.customer?.customer_type === 'residential' 
                          ? `${selectedEstimate.customer?.first_name} ${selectedEstimate.customer?.last_name}`
                          : selectedEstimate.customer?.company_name
                        }
                      </span>
                    </div>
                    {selectedEstimate.customer_site && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Site:</span>
                        <span className="text-sm text-gray-900">{selectedEstimate.customer_site.site_name}</span>
                      </div>
                    )}
                    {selectedEstimate.customer?.email && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Email:</span>
                        <span className="text-sm text-gray-900">{selectedEstimate.customer.email}</span>
                      </div>
                    )}
                    {selectedEstimate.customer?.phone && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Phone:</span>
                        <span className="text-sm text-gray-900">{selectedEstimate.customer.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="mt-8 bg-gray-50 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Financial Summary</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700">Subtotal:</span>
                    <span className="text-sm text-gray-900">${selectedEstimate.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700">Tax ({selectedEstimate.tax_rate}%):</span>
                    <span className="text-sm text-gray-900">${selectedEstimate.tax_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-gray-200">
                    <span className="text-lg font-bold text-gray-900">Total:</span>
                    <span className="text-lg font-bold text-gray-900">${selectedEstimate.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedEstimate.notes && (
                <div className="mt-6">
                  <h5 className="text-md font-medium text-gray-900 mb-3">Notes</h5>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">{selectedEstimate.notes}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => generateEstimatePDF(selectedEstimate)}
                  disabled={generatingPDF}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {generatingPDF ? 'Generating...' : 'Download PDF'}
                </button>
                <button
                  onClick={() => startEdit(selectedEstimate)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit Estimate
                </button>
                <button
                  onClick={() => setSelectedEstimate(null)}
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