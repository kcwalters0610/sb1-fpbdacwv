import React, { useState, useEffect } from 'react'
import { 
  Building2, 
  User, 
  Save, 
  Upload, 
  FileText, 
  Hash,
  Settings as SettingsIcon,
  Users,
  Palette,
  Bell,
  Shield,
  Globe,
  Database,
  Wrench,
  DollarSign,
  Link,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import TeamMemberSettings from './TeamMemberSettings'
import LaborRatesSettings from './LaborRatesSettings'
import SubscriptionSettings from './SubscriptionSettings'

interface CompanySettings {
  logo_url?: string
  theme_color?: string
  work_types?: string[]
  numbering?: {
    workOrderPrefix: string
    workOrderFormat: string
    workOrderNext: string
    estimatePrefix: string
    estimateFormat: string
    estimateNext: string
    invoicePrefix: string
    invoiceFormat: string
    invoiceNext: string
    projectPrefix: string
    projectFormat: string
    projectNext: string
    purchaseOrderPrefix: string
    purchaseOrderFormat: string
    purchaseOrderNext: string
  }
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('company')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [workTypes, setWorkTypes] = useState<string[]>(['Installation', 'Maintenance', 'Repair', 'Other'])
  const [newWorkType, setNewWorkType] = useState('')
  const [editingWorkType, setEditingWorkType] = useState<{ index: number; value: string } | null>(null)

  // Logo upload state
  const [logoError, setLogoError] = useState('')
  
  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  
  // QuickBooks integration state
  const [quickbooksForm, setQuickbooksForm] = useState({
    enabled: false,
    company_id: '',
    access_token: '',
    refresh_token: '',
    sync_customers: true,
    sync_invoices: true,
    sync_items: true,
    auto_sync: false,
    last_sync: null as string | null
  })
  const [quickbooksLoading, setQuickbooksLoading] = useState(false)
  const [quickbooksError, setQuickbooksError] = useState('')
  const [quickbooksSuccess, setQuickbooksSuccess] = useState('')
  
  // Company form data
  const [companyForm, setCompanyForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
  })

  // Profile form data
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: ''
  })

  // Document numbering form data
  const [numberingForm, setNumberingForm] = useState({
    workOrderPrefix: 'WO',
    workOrderFormat: 'WO-{YYYY}-{####}',
    workOrderNext: '1',
    estimatePrefix: 'EST',
    estimateFormat: 'EST-{YYYY}-{####}',
    estimateNext: '1',
    invoicePrefix: 'INV',
    invoiceFormat: 'INV-{YYYY}-{####}',
    invoiceNext: '1',
    projectPrefix: 'PROJ',
    projectFormat: 'PROJ-{YYYY}-{####}',
    projectNext: '1',
    purchaseOrderPrefix: 'PO',
    purchaseOrderFormat: 'PO-{YYYY}-{####}',
    purchaseOrderNext: '1'
  })

  useEffect(() => {
    getCurrentUser()
    loadCompanyData()
  }, [])

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
        setProfileForm({
          first_name: profile?.first_name || '',
          last_name: profile?.last_name || '',
          email: profile?.email || '',
          phone: profile?.phone || ''
        })
      }
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const loadCompanyData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile) return

      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single()

      if (companyData) {
        setCompany(companyData)
        setCompanyForm({
          name: companyData.name || '',
          email: companyData.email || '',
          phone: companyData.phone || '',
          address: companyData.address || '',
          city: companyData.city || '',
          state: companyData.state || '',
          zip_code: companyData.zip_code || '',
          industry: companyData.industry || 'HVAC'
        })

        const settings: CompanySettings = companyData.settings || {}
        setWorkTypes(settings.work_types || ['Installation', 'Maintenance', 'Repair', 'Other'])
        
        // Load numbering settings
        if (settings.numbering) {
          setNumberingForm({
            workOrderPrefix: settings.numbering.workOrderPrefix || 'WO',
            workOrderFormat: settings.numbering.workOrderFormat || 'WO-{YYYY}-{####}',
            workOrderNext: settings.numbering.workOrderNext || '1',
            estimatePrefix: settings.numbering.estimatePrefix || 'EST',
            estimateFormat: settings.numbering.estimateFormat || 'EST-{YYYY}-{####}',
            estimateNext: settings.numbering.estimateNext || '1',
            invoicePrefix: settings.numbering.invoicePrefix || 'INV',
            invoiceFormat: settings.numbering.invoiceFormat || 'INV-{YYYY}-{####}',
            invoiceNext: settings.numbering.invoiceNext || '1',
            projectPrefix: settings.numbering.projectPrefix || 'PROJ',
            projectFormat: settings.numbering.projectFormat || 'PROJ-{YYYY}-{####}',
            projectNext: settings.numbering.projectNext || '1',
            purchaseOrderPrefix: settings.numbering.purchaseOrderPrefix || 'PO',
            purchaseOrderFormat: settings.numbering.purchaseOrderFormat || 'PO-{YYYY}-{####}',
            purchaseOrderNext: settings.numbering.purchaseOrderNext || '1'
          })
        }
        
        // Load QuickBooks settings
        if (settings.quickbooks) {
          setQuickbooksForm({
            enabled: settings.quickbooks.enabled || false,
            company_id: settings.quickbooks.company_id || '',
            access_token: settings.quickbooks.access_token || '',
            refresh_token: settings.quickbooks.refresh_token || '',
            sync_customers: settings.quickbooks.sync_customers !== false,
            sync_invoices: settings.quickbooks.sync_invoices !== false,
            sync_items: settings.quickbooks.sync_items !== false,
            auto_sync: settings.quickbooks.auto_sync || false,
            last_sync: settings.quickbooks.last_sync || null
          })
        }
      }
    } catch (error) {
      console.error('Error loading company data:', error)
    } finally {
      setLoading(false)
    }
  }

  const savePasswordSettings = async () => {
    setSaving(true)
    setPasswordError('')
    setPasswordSuccess('')
    
    try {
      if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        throw new Error('All password fields are required')
      }
      
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error('New passwords do not match')
      }
      
      if (passwordForm.newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long')
      }
      
      // Update password using Supabase auth
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      })
      
      if (error) throw error
      
      setPasswordSuccess('Password updated successfully!')
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (error) {
      console.error('Error updating password:', error)
      setPasswordError((error as Error).message)
    } finally {
      setSaving(false)
    }
  }
  const saveCompanySettings = async () => {
    setSaving(true)
    try {
      if (!company?.id) throw new Error('No company found')

      const { error } = await supabase
        .from('companies')
        .update(companyForm)
        .eq('id', company.id)

      if (error) throw error
      alert('Company settings saved successfully!')
    } catch (error) {
      console.error('Error saving company settings:', error)
      alert('Error saving company settings')
    } finally {
      setSaving(false)
    }
  }

  const saveProfileSettings = async () => {
    setSaving(true)
    try {
      if (!currentUser?.profile?.id) throw new Error('No user profile found')

      const { error } = await supabase
        .from('profiles')
        .update(profileForm)
        .eq('id', currentUser.profile.id)

      if (error) throw error
      alert('Profile settings saved successfully!')
    } catch (error) {
      console.error('Error saving profile settings:', error)
      alert('Error saving profile settings')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLogoError('')
    setSaving(true)

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file')
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB')
      }

      if (!company?.id) throw new Error('No company found')

      // Get file extension
      const fileExt = file.name.split('.').pop()
      const fileName = `${company.id}/logo.${fileExt}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName)

      // Update company settings with logo URL
      const currentSettings = company.settings || {}
      const updatedSettings = {
        ...currentSettings,
        logo_url: publicUrl
      }

      const { error: updateError } = await supabase
        .from('companies')
        .update({ settings: updatedSettings })
        .eq('id', company.id)

      if (updateError) throw updateError

      // Update local state
      setCompany({ ...company, settings: updatedSettings })
      alert('Logo uploaded successfully!')
    } catch (error) {
      console.error('Error uploading logo:', error)
      const errorMessage = (error as Error).message
      if (errorMessage.includes('Bucket not found')) {
        setLogoError('Storage bucket not configured. Please contact your administrator to set up file storage.')
      } else {
        setLogoError(errorMessage)
      }
    } finally {
      setSaving(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const removeLogo = async () => {
    if (!confirm('Are you sure you want to remove the company logo?')) return
    if (!company?.id) return

    setSaving(true)
    try {
      // Update company settings to remove logo URL
      const currentSettings = company.settings || {}
      const updatedSettings = {
        ...currentSettings,
        logo_url: null
      }

      const { error } = await supabase
        .from('companies')
        .update({ settings: updatedSettings })
        .eq('id', company.id)

      if (error) throw error

      // Update local state
      setCompany({ ...company, settings: updatedSettings })
      alert('Logo removed successfully!')
    } catch (error) {
      console.error('Error removing logo:', error)
      alert('Error removing logo')
    } finally {
      setSaving(false)
    }
  }

  const saveWorkTypes = async () => {
    setSaving(true)
    try {
      if (!company?.id) throw new Error('No company found')

      const currentSettings = company.settings || {}
      const updatedSettings = {
        ...currentSettings,
        work_types: workTypes
      }

      const { error } = await supabase
        .from('companies')
        .update({ settings: updatedSettings })
        .eq('id', company.id)

      if (error) throw error
      alert('Work types saved successfully!')
    } catch (error) {
      console.error('Error saving work types:', error)
      alert('Error saving work types')
    } finally {
      setSaving(false)
    }
  }

  const saveNumberingSettings = async () => {
    setSaving(true)
    try {
      if (!company?.id) throw new Error('No company found')

      const currentSettings = company.settings || {}
      const updatedSettings = {
        ...currentSettings,
        numbering: numberingForm
      }

      const { error } = await supabase
        .from('companies')
        .update({ settings: updatedSettings })
        .eq('id', company.id)

      if (error) throw error
      alert('Document numbering settings saved successfully!')
    } catch (error) {
      console.error('Error saving numbering settings:', error)
      alert('Error saving numbering settings')
    } finally {
      setSaving(false)
    }
  }

  const connectQuickBooks = async () => {
    setQuickbooksLoading(true)
    setQuickbooksError('')
    
    try {
      // In a real implementation, this would redirect to QuickBooks OAuth
      // For now, we'll simulate the connection
      const mockConnection = {
        company_id: 'qb_' + Math.random().toString(36).substr(2, 9),
        access_token: 'mock_access_token_' + Date.now(),
        refresh_token: 'mock_refresh_token_' + Date.now()
      }
      
      setQuickbooksForm({
        ...quickbooksForm,
        enabled: true,
        company_id: mockConnection.company_id,
        access_token: mockConnection.access_token,
        refresh_token: mockConnection.refresh_token
      })
      
      setQuickbooksSuccess('QuickBooks connected successfully!')
    } catch (error) {
      console.error('Error connecting to QuickBooks:', error)
      setQuickbooksError('Failed to connect to QuickBooks. Please try again.')
    } finally {
      setQuickbooksLoading(false)
    }
  }

  const disconnectQuickBooks = async () => {
    if (!confirm('Are you sure you want to disconnect QuickBooks? This will stop all automatic syncing and remove stored credentials.')) return
    
    setQuickbooksLoading(true)
    setQuickbooksError('')
    
    try {
      // Revoke the refresh token if available
      if (quickbooksForm.refresh_token) {
        try {
          await fetch('https://developer.api.intuit.com/v2/oauth2/tokens/revoke', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${btoa(`${QUICKBOOKS_CONFIG.clientId}:${QUICKBOOKS_CONFIG.clientSecret}`)}`
            },
            body: new URLSearchParams({
              token: quickbooksForm.refresh_token
            })
          })
        } catch (revokeError) {
          console.warn('Failed to revoke QuickBooks token:', revokeError)
        }
      }
      
      setQuickbooksForm({
        enabled: false,
        company_id: '',
        access_token: '',
        refresh_token: '',
        sync_customers: true,
        sync_invoices: true,
        sync_items: true,
        auto_sync: false,
        last_sync: null
      })
      
      setQuickbooksSuccess('QuickBooks disconnected successfully')
    } catch (error) {
      setQuickbooksError('Failed to disconnect QuickBooks')
    } finally {
      setQuickbooksLoading(false)
    }
  }

  const saveQuickBooksSettings = async () => {
    setSaving(true)
    setQuickbooksError('')
    
    try {
      if (!company?.id) throw new Error('No company found')

      const currentSettings = company.settings || {}
      const updatedSettings = {
        ...currentSettings,
        quickbooks: quickbooksForm
      }

      const { error } = await supabase
        .from('companies')
        .update({ settings: updatedSettings })
        .eq('id', company.id)

      if (error) throw error
      setQuickbooksSuccess('QuickBooks settings saved successfully!')
    } catch (error) {
      console.error('Error saving QuickBooks settings:', error)
      setQuickbooksError('Error saving QuickBooks settings')
    } finally {
      setSaving(false)
    }
  }

  const syncWithQuickBooks = async () => {
    setQuickbooksLoading(true)
    setQuickbooksError('')
    
    try {
      // In a real implementation, this would call your QuickBooks sync API
      // For now, we'll simulate the sync
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setQuickbooksForm({
        ...quickbooksForm,
        last_sync: new Date().toISOString()
      })
      
      setQuickbooksSuccess('Data synced with QuickBooks successfully!')
    } catch (error) {
      console.error('Error syncing with QuickBooks:', error)
      setQuickbooksError('Failed to sync with QuickBooks. Please try again.')
    } finally {
      setQuickbooksLoading(false)
    }
  }

  const addWorkType = () => {
    if (newWorkType.trim() && !workTypes.includes(newWorkType.trim())) {
      setWorkTypes([...workTypes, newWorkType.trim()])
      setNewWorkType('')
    }
  }

  const removeWorkType = (index: number) => {
    setWorkTypes(workTypes.filter((_, i) => i !== index))
  }

  const startEditWorkType = (index: number) => {
    setEditingWorkType({ index, value: workTypes[index] })
  }

  const saveEditWorkType = () => {
    if (editingWorkType && editingWorkType.value.trim()) {
      const newWorkTypes = [...workTypes]
      newWorkTypes[editingWorkType.index] = editingWorkType.value.trim()
      setWorkTypes(newWorkTypes)
      setEditingWorkType(null)
    }
  }

  const cancelEditWorkType = () => {
    setEditingWorkType(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'password', name: 'Password', icon: Shield },
    ...(currentUser?.profile?.role === 'admin' ? [
      { id: 'company', name: 'Company', icon: Building2 },
      { id: 'work-types', name: 'Work Types', icon: Wrench },
      { id: 'numbering', name: 'Document Numbering', icon: Hash },
      { id: 'quickbooks', name: 'QuickBooks', icon: Link },
      { id: 'labor-rates', name: 'Labor Rates', icon: DollarSign },
      { id: 'team', name: 'Team Members', icon: Users },
      { id: 'subscription', name: 'Subscription', icon: SettingsIcon }
    ] : [])
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your company and account settings</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Company Settings */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Company Logo Upload Section */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Logo
                    </label>
                    
                    {/* Current Logo Display */}
                    {company?.settings?.logo_url && (
                      <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <img 
                              src={company.settings.logo_url} 
                              alt="Company Logo" 
                              className="w-16 h-16 object-contain border border-gray-200 rounded-lg bg-white p-2"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">Current Logo</p>
                              <p className="text-xs text-gray-500">Click to view full size</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={removeLogo}
                            disabled={saving}
                            className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Logo Upload Area */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <div className="text-sm text-gray-600 mb-2">
                        <label htmlFor="logo-upload" className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                          Click to upload
                        </label>
                        <span> or drag and drop</span>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        disabled={saving}
                      />
                    </div>
                    
                    {logoError && (
                      <p className="mt-2 text-sm text-red-600">{logoError}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Industry
                    </label>
                    <select
                      value={companyForm.industry}
                      onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="HVAC">HVAC</option>
                      <option value="Plumbing">Plumbing</option>
                      <option value="Electrical">Electrical</option>
                      <option value="General Contractor">General Contractor</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={companyForm.email}
                      onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      value={companyForm.address}
                      onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={companyForm.city}
                      onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={companyForm.state}
                      onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={companyForm.zip_code}
                      onChange={(e) => setCompanyForm({ ...companyForm, zip_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={saveCompanySettings}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Company Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={profileForm.first_name}
                      onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={profileForm.last_name}
                      onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={saveProfileSettings}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Profile Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Password Settings */}
          {activeTab === 'password' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h3>
                <div className="max-w-md space-y-4">
                  {passwordError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      {passwordError}
                    </div>
                  )}
                  
                  {passwordSuccess && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                      {passwordSuccess}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Password *
                    </label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Password *
                    </label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm New Password *
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={savePasswordSettings}
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Work Types */}
          {activeTab === 'work-types' && currentUser?.profile?.role === 'admin' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Work Types</h3>
                <p className="text-gray-600 mb-6">
                  Manage the types of work your company performs. These will be available when creating work orders.
                </p>

                {/* Add new work type */}
                <div className="flex gap-2 mb-6">
                  <input
                    type="text"
                    value={newWorkType}
                    onChange={(e) => setNewWorkType(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addWorkType()}
                    placeholder="Add new work type..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={addWorkType}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add
                  </button>
                </div>

                {/* Work types list */}
                <div className="space-y-2 mb-6">
                  {workTypes.map((workType, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      {editingWorkType?.index === index ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingWorkType.value}
                            onChange={(e) => setEditingWorkType({ ...editingWorkType, value: e.target.value })}
                            onKeyPress={(e) => e.key === 'Enter' && saveEditWorkType()}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            autoFocus
                          />
                          <button
                            onClick={saveEditWorkType}
                            className="text-green-600 hover:text-green-800"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEditWorkType}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-gray-900">{workType}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEditWorkType(index)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeWorkType(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              ×
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={saveWorkTypes}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save All Work Types'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* QuickBooks Integration */}
          {activeTab === 'quickbooks' && currentUser?.profile?.role === 'admin' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">QuickBooks Integration</h3>
                <p className="text-gray-600 mb-6">
                  Connect your QuickBooks account to automatically sync customers, invoices, and inventory items.
                </p>

                {quickbooksError && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    <div className="flex items-center">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      {quickbooksError}
                    </div>
                  </div>
                )}

                {quickbooksSuccess && (
                  <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      {quickbooksSuccess}
                    </div>
                  </div>
                )}

                {/* Connection Status */}
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        quickbooksForm.enabled ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <Link className={`w-6 h-6 ${
                          quickbooksForm.enabled ? 'text-green-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">
                          QuickBooks {quickbooksForm.enabled ? 'Connected' : 'Not Connected'}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {quickbooksForm.enabled 
                            ? `Company ID: ${quickbooksForm.company_id}`
                            : 'Connect your QuickBooks account to enable automatic syncing'
                          }
                        </p>
                        {quickbooksForm.last_sync && (
                          <p className="text-xs text-gray-500">
                            Last sync: {new Date(quickbooksForm.last_sync).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      {quickbooksForm.enabled ? (
                        <>
                          <button
                            onClick={syncWithQuickBooks}
                            disabled={quickbooksLoading}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${quickbooksLoading ? 'animate-spin' : ''}`} />
                            {quickbooksLoading ? 'Syncing...' : 'Sync Now'}
                          </button>
                          <button
                            onClick={disconnectQuickBooks}
                            className="inline-flex items-center px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={connectQuickBooks}
                          disabled={quickbooksLoading}
                          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          <Link className="w-4 h-4 mr-2" />
                          {quickbooksLoading ? 'Connecting...' : 'Connect QuickBooks'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sync Settings */}
                {quickbooksForm.enabled && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-4">Sync Settings</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                          <div>
                            <h5 className="text-sm font-medium text-gray-900">Sync Customers</h5>
                            <p className="text-sm text-gray-600">Automatically sync customer data between FolioOps and QuickBooks</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={quickbooksForm.sync_customers}
                            onChange={(e) => setQuickbooksForm({ ...quickbooksForm, sync_customers: e.target.checked })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                          <div>
                            <h5 className="text-sm font-medium text-gray-900">Sync Invoices</h5>
                            <p className="text-sm text-gray-600">Automatically sync invoice data between FolioOps and QuickBooks</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={quickbooksForm.sync_invoices}
                            onChange={(e) => setQuickbooksForm({ ...quickbooksForm, sync_invoices: e.target.checked })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                          <div>
                            <h5 className="text-sm font-medium text-gray-900">Sync Inventory Items</h5>
                            <p className="text-sm text-gray-600">Automatically sync inventory items between FolioOps and QuickBooks</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={quickbooksForm.sync_items}
                            onChange={(e) => setQuickbooksForm({ ...quickbooksForm, sync_items: e.target.checked })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                          <div>
                            <h5 className="text-sm font-medium text-gray-900">Automatic Sync</h5>
                            <p className="text-sm text-gray-600">Enable automatic syncing every hour (recommended)</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={quickbooksForm.auto_sync}
                            onChange={(e) => setQuickbooksForm({ ...quickbooksForm, auto_sync: e.target.checked })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={saveQuickBooksSettings}
                        disabled={saving}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : 'Save QuickBooks Settings'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Integration Info */}
                <div className="bg-blue-50 rounded-lg p-6">
                  <h4 className="text-md font-medium text-blue-900 mb-3">About QuickBooks Integration</h4>
                  <div className="space-y-2 text-sm text-blue-800">
                    <p>• Automatically sync customer information between systems</p>
                    <p>• Export invoices directly to QuickBooks for accounting</p>
                    <p>• Keep inventory levels synchronized across platforms</p>
                    <p>• Reduce manual data entry and improve accuracy</p>
                    <p>• Available on Business plan and higher</p>
                  </div>
                </div>

                {/* Sync Status */}
                {quickbooksForm.enabled && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Sync Status</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-green-900">Customers</p>
                        <p className="text-xs text-green-700">Last synced: Today</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-green-900">Invoices</p>
                        <p className="text-xs text-green-700">Last synced: Today</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-green-900">Items</p>
                        <p className="text-xs text-green-700">Last synced: Today</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Document Numbering */}
          {activeTab === 'numbering' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Document Numbering</h3>
                <p className="text-gray-600 mb-6">
                  Configure how your documents are numbered. Use {'{YYYY}'} for year and {'{####}'} for sequential numbers.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Work Orders */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900">Work Orders</h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prefix
                      </label>
                      <input
                        type="text"
                        value={numberingForm.workOrderPrefix}
                        onChange={(e) => setNumberingForm({ ...numberingForm, workOrderPrefix: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Format
                      </label>
                      <input
                        type="text"
                        value={numberingForm.workOrderFormat}
                        onChange={(e) => setNumberingForm({ ...numberingForm, workOrderFormat: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="WO-{YYYY}-{####}"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Next Number
                      </label>
                      <input
                        type="number"
                        value={numberingForm.workOrderNext}
                        onChange={(e) => setNumberingForm({ ...numberingForm, workOrderNext: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                  </div>

                  {/* Estimates */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900">Estimates</h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prefix
                      </label>
                      <input
                        type="text"
                        value={numberingForm.estimatePrefix}
                        onChange={(e) => setNumberingForm({ ...numberingForm, estimatePrefix: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Format
                      </label>
                      <input
                        type="text"
                        value={numberingForm.estimateFormat}
                        onChange={(e) => setNumberingForm({ ...numberingForm, estimateFormat: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="EST-{YYYY}-{####}"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Next Number
                      </label>
                      <input
                        type="number"
                        value={numberingForm.estimateNext}
                        onChange={(e) => setNumberingForm({ ...numberingForm, estimateNext: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                  </div>

                  {/* Invoices */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900">Invoices</h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prefix
                      </label>
                      <input
                        type="text"
                        value={numberingForm.invoicePrefix}
                        onChange={(e) => setNumberingForm({ ...numberingForm, invoicePrefix: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Format
                      </label>
                      <input
                        type="text"
                        value={numberingForm.invoiceFormat}
                        onChange={(e) => setNumberingForm({ ...numberingForm, invoiceFormat: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="INV-{YYYY}-{####}"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Next Number
                      </label>
                      <input
                        type="number"
                        value={numberingForm.invoiceNext}
                        onChange={(e) => setNumberingForm({ ...numberingForm, invoiceNext: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                  </div>

                  {/* Projects */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900">Projects</h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prefix
                      </label>
                      <input
                        type="text"
                        value={numberingForm.projectPrefix}
                        onChange={(e) => setNumberingForm({ ...numberingForm, projectPrefix: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Format
                      </label>
                      <input
                        type="text"
                        value={numberingForm.projectFormat}
                        onChange={(e) => setNumberingForm({ ...numberingForm, projectFormat: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="PROJ-{YYYY}-{####}"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Next Number
                      </label>
                      <input
                        type="number"
                        value={numberingForm.projectNext}
                        onChange={(e) => setNumberingForm({ ...numberingForm, projectNext: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                  </div>

                  {/* Purchase Orders */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900">Purchase Orders</h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prefix
                      </label>
                      <input
                        type="text"
                        value={numberingForm.purchaseOrderPrefix}
                        onChange={(e) => setNumberingForm({ ...numberingForm, purchaseOrderPrefix: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Format
                      </label>
                      <input
                        type="text"
                        value={numberingForm.purchaseOrderFormat}
                        onChange={(e) => setNumberingForm({ ...numberingForm, purchaseOrderFormat: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="PO-{YYYY}-{####}"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Next Number
                      </label>
                      <input
                        type="number"
                        value={numberingForm.purchaseOrderNext}
                        onChange={(e) => setNumberingForm({ ...numberingForm, purchaseOrderNext: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-8">
                  <button
                    onClick={saveNumberingSettings}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Numbering Settings'}
                  </button>
                </div>

                {/* Format Examples */}
                <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">Format Examples</h5>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p><code>{'{YYYY}'}</code> - Current year (e.g., 2024)</p>
                    <p><code>{'{####}'}</code> - Sequential number with leading zeros (e.g., 0001, 0002)</p>
                    <p><code>WO-{'{YYYY}'}-{'{####}'}</code> - Results in: WO-2024-0001</p>
                    <p><code>INV{'{####}'}</code> - Results in: INV0001</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Team Members */}
          {activeTab === 'team' && (
            <TeamMemberSettings />
          )}

          {/* Labor Rates */}
          {activeTab === 'labor-rates' && (
            <LaborRatesSettings />
          )}

          {/* Subscription */}
          {activeTab === 'subscription' && (
            <SubscriptionSettings />
          )}
        </div>
      </div>
    </div>
  )
}