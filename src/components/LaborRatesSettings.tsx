import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Save, DollarSign, Building2, User } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface LaborRate {
  id: string
  company_id: string
  department_id?: string
  role: 'admin' | 'manager' | 'tech' | 'office'
  hourly_rate: number
  overtime_rate: number
  effective_date: string
  is_active: boolean
  created_at: string
  updated_at: string
  department?: {
    id: string
    name: string
  }
}

interface Department {
  id: string
  name: string
}

export default function LaborRatesSettings() {
  const [laborRates, setLaborRates] = useState<LaborRate[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingRate, setEditingRate] = useState<LaborRate | null>(null)

  const [formData, setFormData] = useState({
    department_id: '',
    role: 'tech' as 'admin' | 'manager' | 'tech' | 'office',
    hourly_rate: '',
    overtime_rate: '',
    double_time_rate: '',
    effective_date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [ratesResult, departmentsResult] = await Promise.all([
        supabase
          .from('labor_rates')
          .select(`
            *,
            department:departments(id, name)
          `)
          .order('role')
          .order('effective_date', { ascending: false }),
        supabase
          .from('departments')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
      ])

      setLaborRates(ratesResult.data || [])
      setDepartments(departmentsResult.data || [])
    } catch (error) {
      console.error('Error loading labor rates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile) throw new Error('Profile not found')

      // Deactivate existing rates for this role/department combination
      if (!editingRate) {
        let query = supabase
          .from('labor_rates')
          .update({ is_active: false })
          .eq('company_id', profile.company_id)
          .eq('role', formData.role)

        if (formData.department_id) {
          query = query.eq('department_id', formData.department_id)
        } else {
          query = query.is('department_id', null)
        }

        const { error: deactivateError } = await query

        if (deactivateError) throw deactivateError
      }

      const rateData = {
        company_id: profile.company_id,
        department_id: formData.department_id || null,
        role: formData.role,
        hourly_rate: parseFloat(formData.hourly_rate),
        overtime_rate: parseFloat(formData.overtime_rate) || parseFloat(formData.hourly_rate) * 1.5,
        double_time_rate: parseFloat(formData.double_time_rate) || parseFloat(formData.hourly_rate) * 2.0,
        effective_date: formData.effective_date,
        is_active: true
      }

      if (editingRate) {
        const { error } = await supabase
          .from('labor_rates')
          .update(rateData)
          .eq('id', editingRate.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('labor_rates')
          .insert([rateData])
        if (error) throw error
      }

      setShowForm(false)
      setEditingRate(null)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving labor rate:', error)
      alert('Error saving labor rate: ' + (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFormData({
      department_id: '',
      role: 'tech',
      hourly_rate: '',
      overtime_rate: '',
      double_time_rate: '',
      effective_date: new Date().toISOString().split('T')[0]
    })
  }

  const startEdit = (rate: LaborRate) => {
    setEditingRate(rate)
    setFormData({
      department_id: rate.department_id || '',
      role: rate.role,
      hourly_rate: rate.hourly_rate.toString(),
      overtime_rate: rate.overtime_rate.toString(),
      double_time_rate: rate.double_time_rate?.toString() || '',
      effective_date: rate.effective_date
    })
    setShowForm(true)
  }

  const deleteRate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this labor rate?')) return

    try {
      const { error } = await supabase
        .from('labor_rates')
        .delete()
        .eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting labor rate:', error)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800'
      case 'manager': return 'bg-blue-100 text-blue-800'
      case 'tech': return 'bg-green-100 text-green-800'
      case 'office': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Labor Rates</h3>
          <p className="text-gray-600">Set hourly rates for different roles and departments</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setEditingRate(null)
            setShowForm(true)
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Labor Rate
        </button>
      </div>

      {/* Labor Rates Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hourly Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Overtime Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Double Time Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Effective Date
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
              {laborRates.map((rate) => (
                <tr key={rate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(rate.role)}`}>
                      {rate.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rate.department ? rate.department.name : 'All Departments'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${rate.hourly_rate.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${rate.overtime_rate.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${rate.double_time_rate?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(rate.effective_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      rate.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {rate.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEdit(rate)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteRate(rate.id)}
                        className="text-red-600 hover:text-red-800"
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
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingRate ? 'Edit Labor Rate' : 'Add Labor Rate'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
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
                  Department
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hourly Rate *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="25.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Overtime Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.overtime_rate}
                  onChange={(e) => setFormData({ ...formData, overtime_rate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="37.50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to auto-calculate as 1.5x hourly rate
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Double Time Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.double_time_rate}
                  onChange={(e) => setFormData({ ...formData, double_time_rate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="50.00"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to auto-calculate as 2x hourly rate
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Effective Date *
                </label>
                <input
                  type="date"
                  value={formData.effective_date}
                  onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
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
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : (editingRate ? 'Update' : 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}