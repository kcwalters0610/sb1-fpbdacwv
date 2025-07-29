import React, { useState, useEffect } from 'react'
import { 
  User, 
  UserPlus, 
  Mail, 
  Shield, 
  CheckCircle, 
  XCircle, 
  Edit, 
  Trash2, 
  AlertTriangle,
  Crown,
  Wrench,
  Building2
} from 'lucide-react'
import { supabase } from '../lib/supabase'

interface TeamMember {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'manager' | 'tech'
  is_active: boolean
  created_at: string
  department?: {
    id: string
    name: string
  }
}

interface Department {
  id: string
  name: string
}

export default function TeamMemberSettings() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formError, setFormError] = useState('')

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'tech' as 'admin' | 'manager' | 'tech' | 'office',
    department_id: '',
    password: ''
  })

  // Edit form state
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    role: 'tech' as 'admin' | 'manager' | 'tech' | 'office',
    is_active: true,
    department_id: ''
  })

  useEffect(() => {
    getCurrentUser()
    loadTeamMembers()
    loadDepartments()
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
      }
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const loadTeamMembers = async () => {
    try {
      setLoading(true)
      
      // Get current user's company_id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()
      
      if (!profile) return

      // Load team members with their department info
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          department:department_members(
            department:departments(id, name)
          )
        `)
        .eq('company_id', profile.company_id)
        .order('first_name')

      if (error) throw error

      // Process the data to flatten the department info
      const processedData = data.map(member => ({
        ...member,
        department: member.department && member.department.length > 0 
          ? member.department[0].department 
          : undefined
      }))

      setTeamMembers(processedData)
    } catch (error) {
      console.error('Error loading team members:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setDepartments(data || [])
    } catch (error) {
      console.error('Error loading departments:', error)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    
    // Check if current user is admin
    if (!currentUser?.profile?.role || currentUser.profile.role !== 'admin') {
      setFormError('Only administrators can create team members')
      return
    }
    
    setLoading(true)
    
    try {
      if (!inviteForm.password || inviteForm.password.length < 6) {
        throw new Error('Password must be at least 6 characters long')
      }
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session')
      }

      // Call the Edge Function to create the user
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-team-member`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteForm.email,
          password: inviteForm.password,
          first_name: inviteForm.first_name,
          last_name: inviteForm.last_name,
          role: inviteForm.role,
          department_id: inviteForm.department_id || null
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to create user')
      }

      setShowInviteForm(false)
      resetInviteForm()
      loadTeamMembers()
      alert(`User ${inviteForm.first_name} ${inviteForm.last_name} (${inviteForm.email}) created successfully!`)

    } catch (error) {
      console.error('Error inviting team member:', error)
      setFormError((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleInviteOld = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
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

      // Check if email already exists
      const { data: existingUsers } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', inviteForm.email)
      
      if (existingUsers && existingUsers.length > 0) {
        throw new Error('A user with this email already exists')
      }
      
      // Create the user directly without sending an email
      if (!inviteForm.send_email) {
        if (!inviteForm.password || inviteForm.password.length < 6) {
          throw new Error('Password must be at least 6 characters long')
        }
        
        // This will fail - keeping for reference
        const { data: newUser, error: authError } = await supabase.auth.signUp({
          email: inviteForm.email,
          password: inviteForm.password,
          options: {
            data: {
              first_name: inviteForm.first_name,
              last_name: inviteForm.last_name,
              role: inviteForm.role
            }
          }
        })
        
        if (authError) throw authError
        
        if (newUser?.user) {
          // Insert the profile record
          const { error: profileInsertError } = await supabase
            .from('profiles')
            .upsert([{
              id: newUser.user.id,
              email: inviteForm.email,
              company_id: profile.company_id,
              first_name: inviteForm.first_name,
              last_name: inviteForm.last_name,
              role: inviteForm.role,
              is_active: true
            }])
          
          if (profileInsertError) throw profileInsertError
          
          // Add to department if selected
          if (inviteForm.department_id) {
            const { error: deptError } = await supabase
              .from('department_members')
              .insert([{
                department_id: inviteForm.department_id,
                user_id: newUser.user.id
              }])
            
            if (deptError) throw deptError
          }
          
          setShowInviteForm(false)
          resetInviteForm()
          loadTeamMembers()
          alert(`User ${inviteForm.first_name} ${inviteForm.last_name} (${inviteForm.email}) created successfully!`)
          return
        }
      }

      // Handle invitation email case
      if (inviteForm.send_email) {
        // In a real app, you would send an invitation email here
        // For now, we'll just show a success message
        setShowInviteForm(false)
        resetInviteForm()
        alert(`Invitation will be sent to ${inviteForm.email}`)
        return
      }
      
    } catch (error) {
      console.error('Error inviting team member:', error)
      setFormError((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    
    if (!selectedMember) return
    
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          role: editForm.role,
          is_active: editForm.is_active
        })
        .eq('id', selectedMember.id)
      
      if (profileError) throw profileError

      // Handle department assignment
      if (editForm.department_id) {
        // Check if already in this department
        const { data: existingMembership } = await supabase
          .from('department_members')
          .select('id')
          .eq('user_id', selectedMember.id)
          .eq('department_id', editForm.department_id)
        
        // If not in this department, add them
        if (!existingMembership || existingMembership.length === 0) {
          // First remove from any existing departments
          await supabase
            .from('department_members')
            .delete()
            .eq('user_id', selectedMember.id)
          
          // Then add to the new department
          const { error: deptError } = await supabase
            .from('department_members')
            .insert([{
              department_id: editForm.department_id,
              user_id: selectedMember.id
            }])
          
          if (deptError) throw deptError
        }
      } else {
        // If no department selected, remove from all departments
        await supabase
          .from('department_members')
          .delete()
          .eq('user_id', selectedMember.id)
      }

      setShowEditForm(false)
      setSelectedMember(null)
      loadTeamMembers()
    } catch (error) {
      console.error('Error updating team member:', error)
      setFormError((error as Error).message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team member? This action cannot be undone.')) return
    
    try {
      // In a real app, you would handle this more carefully
      // For now, we'll just deactivate the user
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', id)
      
      if (error) throw error
      
      loadTeamMembers()
    } catch (error) {
      console.error('Error deleting team member:', error)
      alert('Error deleting team member')
    }
  }

  const resetInviteForm = () => {
    setInviteForm({
      email: '',
      first_name: '',
      last_name: '',
      role: 'tech',
      department_id: '',
      password: ''
    })
  }

  const startEdit = (member: TeamMember) => {
    setSelectedMember(member)
    setEditForm({
      first_name: member.first_name,
      last_name: member.last_name,
      role: member.role,
      is_active: member.is_active,
      department_id: member.department?.id || ''
    })
    setShowEditForm(true)
  }

  const filteredMembers = teamMembers.filter(member => 
    `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="w-5 h-5 text-purple-600" />
      case 'manager': return <User className="w-5 h-5 text-blue-600" />
      case 'tech': return <Wrench className="w-5 h-5 text-green-600" />
      case 'office': return <Building2 className="w-5 h-5 text-orange-600" />
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800'
      case 'manager': return 'bg-blue-100 text-blue-800'
      case 'tech': return 'bg-green-100 text-green-800'
      case 'office': return 'bg-orange-100 text-orange-800'
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
          <p className="text-gray-600">Manage your team members and their permissions</p>
        </div>
        {currentUser?.profile?.role === 'admin' && (
          <button
            onClick={() => {
              resetInviteForm()
              setShowInviteForm(true)
            }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Invite Team Member
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Team Members Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
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
              {filteredMembers.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          member.role === 'admin' ? 'bg-purple-100' :
                          member.role === 'manager' ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          {getRoleIcon(member.role)}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {member.first_name} {member.last_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{member.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(member.role)}`}>
                      {member.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {member.department ? member.department.name : 'None'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      member.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {currentUser?.profile?.role === 'admin' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => startEdit(member)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(member.id)}
                          className="text-red-600 hover:text-red-800 p-1.5 transition-all duration-200 hover:bg-red-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Invite New Team Member
              </h3>
            </div>
            
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  id="first_name"
                  value={inviteForm.first_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, first_name: e.target.value })}
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
                  id="last_name"
                  value={inviteForm.last_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role *
                </label>
                <select
                  value={inviteForm.role}
                  id="role"
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as any })}
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
                  value={inviteForm.department_id}
                  id="department_id"
                  onChange={(e) => setInviteForm({ ...inviteForm, department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Form Modal */}
      {showEditForm && selectedMember && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit Team Member
              </h3>
            </div>
            
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={selectedMember.email}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
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
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role *
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
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
                  value={editForm.department_id}
                  onChange={(e) => setEditForm({ ...editForm, department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  Active Account
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false)
                    setSelectedMember(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Permissions Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Role Permissions</h3>
        
        <div className="space-y-4">
          <div className="flex items-start p-4 bg-purple-50 rounded-lg">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Crown className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="ml-4">
              <h4 className="text-md font-medium text-purple-900">Admin</h4>
              <p className="text-sm text-purple-700 mt-1">
                Full access to all features including user management, company settings, 
                financial data, and system configuration.
              </p>
            </div>
          </div>
          
          <div className="flex items-start p-4 bg-blue-50 rounded-lg">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <h4 className="text-md font-medium text-blue-900">Manager</h4>
              <p className="text-sm text-blue-700 mt-1">
                Can manage work orders, projects, customers, and technicians. 
                Has access to reports and can approve time entries.
              </p>
            </div>
          </div>
          
          <div className="flex items-start p-4 bg-green-50 rounded-lg">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Wrench className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="ml-4">
              <h4 className="text-md font-medium text-green-900">Technician</h4>
              <p className="text-sm text-green-700 mt-1">
                Can view and update assigned work orders, log time, upload photos, 
                and access basic customer information.
              </p>
            </div>
          </div>
          
          <div className="flex items-start p-4 bg-orange-50 rounded-lg">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Building2 className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <div className="ml-4">
              <h4 className="text-md font-medium text-orange-900">Office Staff</h4>
              <p className="text-sm text-orange-700 mt-1">
                Can manage customers, estimates, invoices, and administrative tasks. 
                Has access to CRM features and basic reporting.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}