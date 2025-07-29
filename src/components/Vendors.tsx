import React, { useState, useEffect } from 'react'
import { Plus, Search, Mail, Phone, MapPin, Building2, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'

interface Vendor {
  id: string
  company_id: string
  name: string
  contact_person?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  vendor_type?: string
  notes?: string
  is_active?: boolean
  created_at: string
  updated_at: string
}

export default function Vendors() {
  const { viewType, setViewType } = useViewPreference('vendors')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    vendor_type: '',
    notes: '',
    is_active: true
  })

  const vendorTypes = [
    'HVAC Supplier',
    'Electrical Supplier',
    'Plumbing Supplier',
    'General Contractor',
    'Equipment Rental',
    'Parts Supplier',
    'Service Provider',
    'Other'
  ]

  useEffect(() => {
    loadVendors()
  }, [])

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('name')

      if (error) throw error
      setVendors(data || [])
    } catch (error) {
      console.error('Error loading vendors:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const vendorData = {
        name: formData.name,
        contact_person: formData.contact_person || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        zip_code: formData.zip_code || null,
        vendor_type: formData.vendor_type || null,
        notes: formData.notes || null,
        is_active: formData.is_active
      }

      if (editingVendor) {
        const { error } = await supabase
          .from('vendors')
          .update(vendorData)
          .eq('id', editingVendor.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('vendors')
          .insert([vendorData])
        if (error) throw error
      }

      setShowForm(false)
      setEditingVendor(null)
      resetForm()
      loadVendors()
    } catch (error) {
      console.error('Error saving vendor:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      vendor_type: '',
      notes: '',
      is_active: true
    })
  }

  const startEdit = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setFormData({
      name: vendor.name,
      contact_person: vendor.contact_person || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      city: vendor.city || '',
      state: vendor.state || '',
      zip_code: vendor.zip_code || '',
      vendor_type: vendor.vendor_type || '',
      notes: vendor.notes || '',
      is_active: vendor.is_active ?? true
    })
    setShowForm(true)
  }

  const deleteVendor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return

    try {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id)
      if (error) throw error
      loadVendors()
    } catch (error) {
      console.error('Error deleting vendor:', error)
    }
  }

  const toggleVendorStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ is_active: !currentStatus })
        .eq('id', id)
      if (error) throw error
      loadVendors()
    } catch (error) {
      console.error('Error updating vendor status:', error)
    }
  }

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = !typeFilter || vendor.vendor_type === typeFilter
    return matchesSearch && matchesType
  })

  const activeVendors = vendors.filter(v => v.is_active).length
  const inactiveVendors = vendors.filter(v => !v.is_active).length

  if (loading && vendors.length === 0) {
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
        <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
        <button
          onClick={() => {
            resetForm()
            setEditingVendor(null)
            setShowForm(true)
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Vendor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <Building2 className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Vendors</p>
              <p className="text-2xl font-bold text-gray-900">{vendors.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Vendors</p>
              <p className="text-2xl font-bold text-gray-900">{activeVendors}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <XCircle className="w-8 h-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Inactive Vendors</p>
              <p className="text-2xl font-bold text-gray-900">{inactiveVendors}</p>
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
              placeholder="Search vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            {vendorTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <div className="flex justify-end">
            <ViewToggle viewType={viewType} onViewChange={setViewType} />
          </div>
        </div>
      </div>

      {/* Vendors Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {viewType === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                          {vendor.contact_person && (
                            <div className="text-sm text-gray-500">{vendor.contact_person}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{vendor.email}</div>
                      <div className="text-sm text-gray-500">{vendor.phone}</div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      {vendor.vendor_type && (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full text-blue-700 bg-blue-100">
                          {vendor.vendor_type}
                        </span>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{vendor.address}</div>
                      <div className="text-sm text-gray-500">
                        {vendor.city && vendor.state && `${vendor.city}, ${vendor.state}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleVendorStatus(vendor.id, vendor.is_active ?? true)}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          vendor.is_active 
                            ? 'text-green-700 bg-green-100 hover:bg-green-200' 
                            : 'text-red-700 bg-red-100 hover:bg-red-200'
                        } transition-colors`}
                      >
                        {vendor.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => startEdit(vendor)} 
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteVendor(vendor.id)} 
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
              {filteredVendors.map((vendor) => (
                <div key={vendor.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{vendor.name}</h3>
                        {vendor.contact_person && (
                          <p className="text-sm text-gray-600">{vendor.contact_person}</p>
                        )}
                        <button
                          onClick={() => toggleVendorStatus(vendor.id, vendor.is_active ?? true)}
                          className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                            vendor.is_active 
                              ? 'text-green-700 bg-green-100 hover:bg-green-200' 
                              : 'text-red-700 bg-red-100 hover:bg-red-200'
                          } transition-colors`}
                        >
                          {vendor.is_active ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {vendor.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEdit(vendor)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteVendor(vendor.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    {vendor.email && (
                      <div className="flex items-center text-gray-600">
                        <Mail className="w-4 h-4 mr-3" />
                        <span className="text-sm">{vendor.email}</span>
                      </div>
                    )}
                    
                    {vendor.phone && (
                      <div className="flex items-center text-gray-600">
                        <Phone className="w-4 h-4 mr-3" />
                        <span className="text-sm">{vendor.phone}</span>
                      </div>
                    )}
                    
                    {vendor.address && (
                      <div className="flex items-center text-gray-600">
                        <MapPin className="w-4 h-4 mr-3" />
                        <div className="text-sm">
                          <div>{vendor.address}</div>
                          {vendor.city && vendor.state && (
                            <div className="text-gray-500">{vendor.city}, {vendor.state}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {vendor.vendor_type && (
                      <div className="flex items-center">
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full text-blue-700 bg-blue-100">
                          {vendor.vendor_type}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {vendor.notes && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600">{vendor.notes}</p>
                    </div>
                  )}
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
                {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vendor Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    Vendor Type
                  </label>
                  <select
                    value={formData.vendor_type}
                    onChange={(e) => setFormData({ ...formData, vendor_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Type</option>
                    {vendorTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                    Active Vendor
                  </label>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
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
                  {loading ? 'Saving...' : (editingVendor ? 'Update' : 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}