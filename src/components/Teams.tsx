import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Search, 
  Users, 
  User, 
  Edit, 
  Trash2, 
  UserPlus, 
  UserMinus,
  Building2,
  Crown,
  Wrench
} from 'lucide-react'
import { supabase, Profile } from '../lib/supabase'

interface Department {
  id: string
  company_id: string
  name: string
  description?: string
  manager_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
  manager?: Profile
  member_count?: number
  members?: Profile[]
}

export default function Teams() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeptForm, setShowDeptForm] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false)
  const [targetDepartment, setTargetDepartment] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])

  const [deptFormData, setDeptFormData] = useState({
    name: '',
    description: '',
    manager_id: '',
    is_active: true
  })

  useEffect(() => {
    getCurrentUser()
    loadData()
  }, [])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setCurrentUser({ ...user, profile })
    }
  }

  const loadData = async () => {
    try {
      const [deptResult, usersResult] = await Promise.all([
        supabase
          .from('departments')
          .select(`
            *,
            manager:profiles!departments_manager_id_fkey(*)
          `)
          .order('name'),
        supabase
          .from('profiles')
          .select('*')
          .eq('is_active', true)
          .order('first_name')
      ])

      if (deptResult.error) throw deptResult.error
      if (usersResult.error) throw usersResult.error

      // Get member counts for each department
      const departmentsWithCounts = await Promise.all(
        (deptResult.data || []).map(async (dept) => {
          const { count } = await supabase
            .from('department_members')
            .select('*', { count: 'exact', head: true })
            .eq('department_id', dept.id)

          return {
            ...dept,
            member_count: count || 0
          }
        })
      )

      setDepartments(departmentsWithCounts)
      setAllUsers(usersResult.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Get current user's company_id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()
      
      if (!profile) throw new Error('Profile not found')

      const deptData = {
        name: deptFormData.name,
        description: deptFormData.description || null,
        manager_id: deptFormData.manager_id || null,
        is_active: deptFormData.is_active,
        company_id: profile.company_id
      }

      if (editingDepartment) {
        // For updates, don't include company_id as it shouldn't change
        const { company_id, ...updateData } = deptData
        const { error } = await supabase
          .from('departments')
          .update(updateData)
          .eq('id', editingDepartment.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('departments')
          .insert([deptData])
        if (error) throw error
      }

      setShowDeptForm(false)
      setEditingDepartment(null)
      resetDeptForm()
      loadData()
    } catch (error) {
      console.error('Error saving department:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetDeptForm = () => {
    setDeptFormData({
      name: '',
      description: '',
      manager_id: '',
      is_active: true
    })
  }

  const startEditDept = (dept: Department) => {
    setEditingDepartment(dept)
    setDeptFormData({
      name: dept.name,
      description: dept.description || '',
      manager_id: dept.manager_id || '',
      is_active: dept.is_active
    })
    setShowDeptForm(true)
  }

  const deleteDepartment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department? This will remove all members from the department.')) return

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting department:', error)
    }
  }

  const openMembersModal = async (dept: Department) => {
    try {
      // Load department members
      const { data: members, error } = await supabase
        .from('department_members')
        .select(`
          user_id,
          user:profiles(*)
        `)
        .eq('department_id', dept.id)

      if (error) throw error

      setSelectedDepartment({
        ...dept,
        members: members?.map(m => m.user) || []
      })
      setShowMembersModal(true)
    } catch (error) {
      console.error('Error loading department members:', error)
    }
  }

  const addMemberToDepartment = async (userId: string) => {
    if (!selectedDepartment) return

    try {
      const { error } = await supabase
        .from('department_members')
        .insert([{
          department_id: selectedDepartment.id,
          user_id: userId
        }])

      if (error) throw error
      
      // Refresh members
      openMembersModal(selectedDepartment)
      loadData()
    } catch (error) {
      console.error('Error adding member:', error)
    }
  }

  const removeMemberFromDepartment = async (userId: string) => {
    if (!selectedDepartment) return

    try {
      const { error } = await supabase
        .from('department_members')
        .delete()
        .eq('department_id', selectedDepartment.id)
        .eq('user_id', userId)

      if (error) throw error
      
      // Refresh members
      openMembersModal(selectedDepartment)
      loadData()
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const bulkAssignToDepartment = async () => {
    if (!targetDepartment || selectedUsers.length === 0) return

    try {
      // Remove users from existing departments first
      const { error: removeError } = await supabase
        .from('department_members')
        .delete()
        .in('user_id', selectedUsers)

      if (removeError) throw removeError

      // Add users to new department
      const insertData = selectedUsers.map(userId => ({
        department_id: targetDepartment,
        user_id: userId
      }))

      const { error: insertError } = await supabase
        .from('department_members')
        .insert(insertData)

      if (insertError) throw insertError

      setShowBulkAssignModal(false)
      setSelectedUsers([])
      setTargetDepartment('')
      loadData()
    } catch (error) {
      console.error('Error bulk assigning users:', error)
    }
  }

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const availableManagers = allUsers.filter(user => 
    user.role === 'admin' || user.role === 'manager'
  )

  const availableMembers = selectedDepartment 
    ? allUsers.filter(user => 
        !selectedDepartment.members?.some(member => member.id === user.id)
      )
    : []

  if (loading && departments.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">Teams & Departments</h1>
          <p className="text-gray-600">Organize your team into departments with managers and technicians</p>
        </div>
        {currentUser?.profile?.role === 'admin' && (
          <div className="flex space-x-3">
            <button
              onClick={() => setShowBulkAssignModal(true)}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Users className="w-5 h-5 mr-2" />
              Bulk Assign
            </button>
            <button
              onClick={() => {
                resetDeptForm()
                setEditingDepartment(null)
                setShowDeptForm(true)
              }}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Department
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDepartments.map((dept) => (
          <div key={dept.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{dept.name}</h3>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    dept.is_active 
                      ? 'text-green-700 bg-green-100' 
                      : 'text-red-700 bg-red-100'
                  }`}>
                    {dept.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              {currentUser?.profile?.role === 'admin' && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => startEditDept(dept)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteDepartment(dept.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {dept.description && (
              <p className="text-sm text-gray-600 mb-4">{dept.description}</p>
            )}

            <div className="space-y-3 mb-4">
              <div className="flex items-center text-sm text-gray-600">
                <Crown className="w-4 h-4 mr-3 text-yellow-500" />
                <div>
                  <div className="font-medium text-gray-900">
                    {dept.manager ? 
                      `${dept.manager.first_name} ${dept.manager.last_name}` : 
                      'No manager assigned'
                    }
                  </div>
                  <div className="text-xs">Department Manager</div>
                </div>
              </div>

              <div className="flex items-center text-sm text-gray-600">
                <Users className="w-4 h-4 mr-3" />
                <div>
                  <div className="font-medium text-gray-900">{dept.member_count || 0}</div>
                  <div className="text-xs">Team Members</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => openMembersModal(dept)}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Users className="w-4 h-4 mr-2" />
              Manage Members
            </button>
          </div>
        ))}
      </div>

      {/* Department Form Modal */}
      {showDeptForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingDepartment ? 'Edit Department' : 'Add New Department'}
              </h3>
            </div>
            
            <form onSubmit={handleDeptSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department Name *
                </label>
                <input
                  type="text"
                  value={deptFormData.name}
                  onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., HVAC Install, Plumbing, HVAC Service"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={deptFormData.description}
                  onChange={(e) => setDeptFormData({ ...deptFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of the department"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department Manager
                </label>
                <select
                  value={deptFormData.manager_id}
                  onChange={(e) => setDeptFormData({ ...deptFormData, manager_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No manager assigned</option>
                  {availableManagers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={deptFormData.is_active}
                  onChange={(e) => setDeptFormData({ ...deptFormData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  Active Department
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDeptForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : (editingDepartment ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Assignment Modal */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Bulk Assign Users to Department
                </h3>
                <button
                  onClick={() => setShowBulkAssignModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Department
                </label>
                <select
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-4">Select Users</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {allUsers.map((user) => (
                    <div
                      key={user.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedUsers.includes(user.id)
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => toggleUserSelection(user.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          user.role === 'admin' ? 'bg-purple-100' :
                          user.role === 'manager' ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          {user.role === 'admin' ? (
                            <Crown className="w-4 h-4 text-purple-600" />
                          ) : user.role === 'manager' ? (
                            <User className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Wrench className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {selectedUsers.length > 0 && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg">
                  <h5 className="text-sm font-medium text-green-900 mb-2">
                    Selected Users ({selectedUsers.length})
                  </h5>
                  <div className="text-sm text-green-800">
                    {selectedUsers.map(userId => {
                      const user = allUsers.find(u => u.id === userId)
                      return user ? `${user.first_name} ${user.last_name}` : ''
                    }).join(', ')}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowBulkAssignModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={bulkAssignToDepartment}
                  disabled={!targetDepartment || selectedUsers.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Assign {selectedUsers.length} User{selectedUsers.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assignment Modal */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Bulk Assign Users to Department
                </h3>
                <button
                  onClick={() => setShowBulkAssignModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Department
                </label>
                <select
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-4">Select Users</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {allUsers.map((user) => (
                    <div
                      key={user.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedUsers.includes(user.id)
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => toggleUserSelection(user.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          user.role === 'admin' ? 'bg-purple-100' :
                          user.role === 'manager' ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          {user.role === 'admin' ? (
                            <Crown className="w-4 h-4 text-purple-600" />
                          ) : user.role === 'manager' ? (
                            <User className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Wrench className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {selectedUsers.length > 0 && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg">
                  <h5 className="text-sm font-medium text-green-900 mb-2">
                    Selected Users ({selectedUsers.length})
                  </h5>
                  <div className="text-sm text-green-800">
                    {selectedUsers.map(userId => {
                      const user = allUsers.find(u => u.id === userId)
                      return user ? `${user.first_name} ${user.last_name}` : ''
                    }).join(', ')}
                  </div>
                </div>
              )}
      {/* Members Management Modal */}
      {showMembersModal && selectedDepartment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Manage {selectedDepartment.name} Members
                </h3>
                <button
                  onClick={() => setShowMembersModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Current Members */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-4">Current Members ({selectedDepartment.members?.length || 0})</h4>
                {selectedDepartment.members && selectedDepartment.members.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDepartment.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            member.role === 'admin' ? 'bg-purple-100' :
                            member.role === 'manager' ? 'bg-blue-100' : 'bg-green-100'
                          }`}>
                            {member.role === 'admin' ? (
                              <Crown className="w-4 h-4 text-purple-600" />
                            ) : member.role === 'manager' ? (
                              <User className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Wrench className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                          </div>
                        </div>
                        {(currentUser?.profile?.role === 'admin' || 
                          (currentUser?.profile?.role === 'manager' && selectedDepartment.manager_id === currentUser.id)) && (
                          <button
                            onClick={() => removeMemberFromDepartment(member.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No members assigned to this department</p>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowBulkAssignModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={bulkAssignToDepartment}
                  disabled={!targetDepartment || selectedUsers.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Assign {selectedUsers.length} User{selectedUsers.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
              {/* Available Members */}
              {(currentUser?.profile?.role === 'admin' || 
                (currentUser?.profile?.role === 'manager' && selectedDepartment.manager_id === currentUser.id)) && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">Add Members</h4>
                  {availableMembers.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {availableMembers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              user.role === 'admin' ? 'bg-purple-100' :
                              user.role === 'manager' ? 'bg-blue-100' : 'bg-green-100'
                            }`}>
                              {user.role === 'admin' ? (
                                <Crown className="w-4 h-4 text-purple-600" />
                              ) : user.role === 'manager' ? (
                                <User className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Wrench className="w-4 h-4 text-green-600" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {user.first_name} {user.last_name}
                              </p>
                              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => addMemberToDepartment(user.id)}
                            className="text-green-600 hover:text-green-800"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">All users are already assigned to this department</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}