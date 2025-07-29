import React, { useState, useEffect } from 'react'
import { Plus, Search, Mail, Phone, Wrench, CheckCircle, XCircle, Clock, User, Edit, Trash2, Lock, Eye, EyeOff } from 'lucide-react'
import { supabase, Profile } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'

export default function Technicians() {
  const { viewType, setViewType } = useViewPreference('technicians')
  const [technicians, setTechnicians] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTechnician, setEditingTechnician] = useState<Profile | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'tech' as 'admin' | 'manager' | 'tech' | 'office'
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    loadTechnicians()
  }, [])

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'tech')
        .order('first_name')

      if (error) throw error
      setTechnicians(data || [])
    } catch (error) {
      console.error('Error loading technicians:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setFormError('')

    try {
      // Get current user's profile to get company_id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      const technicianData = {
        ...formData,
        company_id: userProfile.company_id
      }

      if (editingTechnician) {
        const { error } = await supabase
          .from('profiles')
          .update(technicianData)
          .eq('id', editingTechnician.id)
        if (error) throw error
      } else {
        // For new technicians, show a message that they need to be created through admin panel
        throw new Error('New technicians must be created through the admin panel or invited via email. Please contact your system administrator.')
      }

      setShowForm(false)
      setEditingTechnician(null)
      resetForm()
      loadTechnicians()
    } catch (error) {
      console.error('Error saving technician:', error)
      setFormError((error as Error).message)
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
      role: 'tech'
    })
  }

  const startEdit = (technician: Profile) => {
    setEditingTechnician(technician)
    setFormData({
      first_name: technician.first_name,
      last_name: technician.last_name,
      email: technician.email,
      phone: technician.phone || '',
      role: technician.role
    })
    setShowForm(true)
  }

  const deleteTechnician = async (id: string) => {
    if (!confirm('Are you sure you want to delete this technician?')) return

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id)
      if (error) throw error
      loadTechnicians()
    } catch (error) {
      console.error('Error deleting technician:', error)
    }
  }

  const filteredTechnicians = technicians.filter(technician =>
    `${technician.first_name} ${technician.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    technician.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading && technicians.length === 0) {
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
        <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> New team members must be created through the admin panel or invited via email. 
            Contact your system administrator to add new team members.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <ViewToggle viewType={viewType} onViewChange={setViewType} />
        </div>
      </div>

      {/* Technicians Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {viewType === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team Member
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTechnicians.map((technician) => (
                  <tr key={technician.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center ${
                            technician.role === 'admin' ? 'bg-purple-100' :
                            technician.role === 'manager' ? 'bg-blue-100' : 'bg-green-100'
                          }`}>
                            {technician.role === 'admin' ? (
                              <User className={`w-5 h-5 text-purple-600`} />
                            ) : technician.role === 'manager' ? (
                              <User className={`w-5 h-5 text-blue-600`} />
                            ) : (
                              <Wrench className={`w-5 h-5 text-green-600`} />
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {technician.first_name} {technician.last_name}
                          </div>
                          <div className="text-sm text-gray-500 capitalize">{technician.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{technician.email}</div>
                      <div className="text-sm text-gray-500">{technician.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        technician.is_active 
                          ? 'text-green-700 bg-green-100' 
                          : 'text-red-700 bg-red-100'
                      }`}>
                        {technician.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        technician.role === 'admin' ? 'text-purple-700 bg-purple-100' :
                        technician.role === 'manager' ? 'text-blue-700 bg-blue-100' :
                        technician.role === 'office' ? 'text-orange-700 bg-orange-100' :
                        'text-green-700 bg-green-100'
                      }`}>
                        {technician.role.charAt(0).toUpperCase() + technician.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => startEdit(technician)}
                        className="text-blue-600 hover:text-blue-800 mr-2 sm:mr-3 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteTechnician(technician.id)}
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
              {filteredTechnicians.map((technician) => (
                <div key={technician.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        technician.role === 'admin' ? 'bg-purple-100' :
                        technician.role === 'manager' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        {technician.role === 'admin' ? (
                          <User className={`w-6 h-6 text-purple-600`} />
                        ) : technician.role === 'manager' ? (
                          <User className={`w-6 h-6 text-blue-600`} />
                        ) : (
                          <Wrench className={`w-6 h-6 text-green-600`} />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {technician.first_name} {technician.last_name}
                        </h3>
                        <div className="flex items-center space-x-2">
                          {technician.is_active ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            technician.role === 'admin' ? 'text-purple-700 bg-purple-100' :
                            technician.role === 'manager' ? 'text-blue-700 bg-blue-100' :
                            technician.role === 'office' ? 'text-orange-700 bg-orange-100' :
                            'text-green-700 bg-green-100'
                          }`}>
                            {technician.role.charAt(0).toUpperCase() + technician.role.slice(1)}
                          </span>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            technician.is_active 
                              ? 'text-green-700 bg-green-100' 
                              : 'text-red-700 bg-red-100'
                          }`}>
                            {technician.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEdit(technician)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTechnician(technician.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center text-gray-600">
                      <Mail className="w-4 h-4 mr-3" />
                      <span className="text-sm">{technician.email}</span>
                    </div>
                    
                    {technician.phone && (
                      <div className="flex items-center text-gray-600">
                        <Phone className="w-4 h-4 mr-3" />
                        <span className="text-sm">{technician.phone}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center text-gray-600">
                      <User className="w-4 h-4 mr-3" />
                      <span className="text-sm capitalize">{technician.role.charAt(0).toUpperCase() + technician.role.slice(1)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full mx-4">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingTechnician ? 'Edit Team Member' : 'Add New Team Member'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {formError}
                </div>
              )}
            
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
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="tech">Technician</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="office">Office Staff</option>
                </select>
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


              {!editingTechnician && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> New team members must be created through the admin panel or invited via email. 
                    This form is for editing existing team member information only.
                  </p>
                </div>
              )}

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
                  {loading ? 'Saving...' : (editingTechnician ? 'Update' : 'Add Team Member')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}