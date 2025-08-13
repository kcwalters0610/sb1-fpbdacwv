import React, { useEffect, useState } from 'react'
import {
  Plus,
  Search,
  Calendar,
  User,
  Clock,
  Edit,
  Trash2,
  Eye,
  X,
  Camera,
  DollarSign,
  Users,
  Package,
  Square,
  Play,
  Building2,
} from 'lucide-react'
import { supabase, WorkOrder, Customer, Profile, CustomerSite } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'
import { getNextNumber, updateNextNumber } from '../lib/numbering'

export default function WorkOrders() {
  const { viewType, setViewType } = useViewPreference('workOrders')

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [customerSites, setCustomerSites] = useState<CustomerSite[]>([])
  const [projects, setProjects] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)

  const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrder | null>(null)
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null)
  const [assigningWorkOrder, setAssigningWorkOrder] = useState<WorkOrder | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loadingSites, setLoadingSites] = useState(false)
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([])
  const [primaryTechnician, setPrimaryTechnician] = useState<string>('')

  const [workOrderPhotos, setWorkOrderPhotos] = useState<any[]>([])
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [photoCaption, setPhotoCaption] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [workOrderNotes, setWorkOrderNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [truckInventory, setTruckInventory] = useState<any[]>([])
  const [timeEntries, setTimeEntries] = useState<any[]>([])
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [timeFormData, setTimeFormData] = useState({
    start_time: '',
    end_time: '',
    description: '',
    duration_minutes: 0,
  })
  const [activeTimer, setActiveTimer] = useState<{ id: string; start_time: string; work_order_id: string } | null>(null)
  const [timerInterval, setTimerInterval] = useState<ReturnType<typeof setInterval> | null>(null)

  const [formData, setFormData] = useState({
    wo_number: '',
    title: '',
    description: '',
    customer_id: '',
    customer_site_id: '',
    project_id: '',
    department_id: '',
    priority: 'medium',
    status: 'open',
    scheduled_date: '',
    work_type: '',
    notes: '',
  })

  // ---------- Hardened PO navigation helper ----------
  const gotoPurchaseOrdersFromWO = (wo: WorkOrder | null) => {
    if (!wo || typeof window === 'undefined') return

    // Close the detail modal first so overlays can't block the next view
    setSelectedWorkOrder(null)

    // Persist the selection in both formats (simple id + rich payload)
    try {
      localStorage.setItem('preselected_work_order', wo.id)
      localStorage.setItem(
        'preselected_work_order_payload',
        JSON.stringify({ id: wo.id, wo_number: wo.wo_number, title: wo.title })
      )
    } catch {}

    // Emit a variety of navigation events for different app listeners
    const emit = (name: string, detail: any) => {
      try { window.dispatchEvent(new CustomEvent(name, { detail })) } catch {}
      try { document.dispatchEvent(new CustomEvent(name, { detail })) } catch {}
    }
    emit('navigate', 'purchase-orders')
    emit('navigate', { page: 'purchase-orders', to: 'purchase-orders' })
    emit('navigation', 'purchase-orders')
    emit('route', 'purchase-orders')
    emit('app:navigate', { to: 'purchase-orders' })
    emit('view:change', { view: 'purchase-orders' })

    // Try common router handles if exposed globally
    try { (window as any).__router?.navigate?.('/purchase-orders') } catch {}
    try { (window as any).router?.navigate?.('purchase-orders') } catch {}
    try { (window as any).goTo?.('purchase-orders') } catch {}
    try { (window as any).navigate?.('purchase-orders') } catch {}

    // Hash-router fallbacks + fire hashchange
    try {
      const variants = ['#/purchase-orders', '#purchase-orders', '/#/purchase-orders']
      for (const h of variants) {
        window.location.hash = h.replace(/^[^#]*/, '#')
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      }
    } catch {}

    // Last-resort: set a hint and hard-redirect
    try {
      localStorage.setItem('active_view_hint', 'purchase-orders')
      const url = new URL(window.location.href)
      url.hash = '#/purchase-orders'
      // Use replace to avoid creating a long history trail
      window.location.replace(url.toString())
    } catch {}
  }
  // ---------------------------------------------------

  useEffect(() => {
    getCurrentUser()
    loadData()
  }, [])

  useEffect(() => {
    if (showForm && !editingWorkOrder) {
      generateWONumber()
    }
  }, [showForm, editingWorkOrder])

  useEffect(() => {
    if (formData.customer_id) {
      loadCustomerSites(formData.customer_id)
    } else {
      setCustomerSites([])
      setFormData((prev) => ({ ...prev, customer_site_id: '' }))
    }
  }, [formData.customer_id])

  useEffect(() => {
    if (selectedWorkOrder) {
      loadWorkOrderDetails(selectedWorkOrder.id)
    }
  }, [selectedWorkOrder])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setCurrentUser({ ...user, profile })
      }
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const generateWONumber = async () => {
    try {
      const { formattedNumber: woNumber } = await getNextNumber('work_order')
      setFormData((prev) => ({ ...prev, wo_number: woNumber }"))
    } catch (error) {
      console.error('Error generating WO number:', error)
    }
  }

  const loadData = async () => {
    try {
      const [workOrdersResult, customersResult, techniciansResult, departmentsResult, projectsResult] = await Promise.all([
        supabase
          .from('work_orders')
          .select(`
            *,
            customer:customers(*),
            assigned_technician:profiles!work_orders_assigned_to_fkey(*),
            assigned_dept:departments!department_id(*),
            customer_site:customer_sites(*),
            project:projects(*),
            assignments:work_order_assignments(
              id,
              tech_id,
              is_primary,
              technician:profiles(*)
            )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('first_name'),
        supabase.from('profiles').select('*').in('role', ['tech', 'admin', 'manager']).order('first_name'),
        supabase.from('departments').select('*').eq('is_active', true).order('name'),
        supabase.from('projects').select('*').in('status', ['planning', 'in_progress']).order('project_name'),
      ])

      setWorkOrders(workOrdersResult.data || [])
      setCustomers(customersResult.data || [])
      setTechnicians(techniciansResult.data || [])
      setDepartments(departmentsResult.data || [])
      setProjects(projectsResult.data || [])
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

  const loadWorkOrderDetails = async (workOrderId: string) => {
    try {
      const { data: photos } = await supabase
        .from('work_order_photos')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false })
      setWorkOrderPhotos(photos || [])

      const { data: pos } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendor:vendors(*),
          items:purchase_order_items(*)
        `)
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false })
      setPurchaseOrders(pos || [])

      const { data: inventory } = await supabase
        .from('truck_inventory')
        .select(`
          *,
          inventory_item:inventory_items(*),
          user:profiles(*)
        `)
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false })
      setTruckInventory(inventory || [])

      const { data: times } = await supabase
        .from('time_entries')
        .select(`
          *,
          user:profiles(*)
        `)
        .eq('work_order_id', workOrderId)
        .order('start_time', { ascending: false })
      setTimeEntries(times || [])

      const wo = workOrders.find((w) => w.id === workOrderId)
      if (wo) setWorkOrderNotes(wo.notes || '')
    } catch (error) {
      console.error('Error loading work order details:', error)
    }
  }

  const handleCreateInvoice = async (workOrder: WorkOrder) => {
    if (!confirm(`Create invoice for Work Order ${workOrder.wo_number}?`)) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile) throw new Error('User profile not found')

      const { data: timeEntries, error: timeError } = await supabase
        .from('time_entries')
        .select(
          `
          *,
          user:profiles(id, first_name, last_name, role)
        `
        )
        .eq('work_order_id', workOrder.id)
        .eq('status', 'approved')
      if (timeError) console.error('Error fetching time entries:', timeError)

      const { data: purchaseOrders, error: poError } = await supabase
        .from('purchase_orders')
        .select(
          `
          *,
          vendor:vendors(name),
          items:purchase_order_items(*)
        `
        )
        .eq('work_order_id', workOrder.id)
        .in('status', ['approved', 'received'])
      if (poError) console.error('Error fetching purchase orders:', poError)

      const { data: truckInventory, error: inventoryError } = await supabase
        .from('truck_inventory')
        .select(
          `
          *,
          inventory_item:inventory_items(name, unit_price)
        `
        )
        .eq('work_order_id', workOrder.id)
      if (inventoryError) console.error('Error fetching truck inventory:', inventoryError)

      const { data: laborRates, error: ratesError } = await supabase
        .from('labor_rates')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
      if (ratesError) console.error('Error fetching labor rates:', ratesError)

      let laborCost = 0
      let purchaseOrderCost = 0
      let materialsCost = 0
      const costBreakdown: string[] = []

      if (timeEntries && timeEntries.length > 0) {
        for (const entry of timeEntries as any[]) {
          const hours = entry.duration_minutes / 60
          const rate = laborRates?.find(
            (r: any) => r.role === entry.user.role && (!r.department_id || r.department_id === workOrder.department_id)
          )
          const hourlyRate = rate?.hourly_rate || 50
          const entryCost = hours * hourlyRate
          laborCost += entryCost
          costBreakdown.push(
            `Labor - ${entry.user.first_name} ${entry.user.last_name}: ${hours.toFixed(1)}h × $${hourlyRate}/h = $${entryCost.toFixed(
              2
            )}`
          )
        }
      }

      if (purchaseOrders && purchaseOrders.length > 0) {
        for (const po of purchaseOrders as any[]) {
          purchaseOrderCost += po.total_amount
          costBreakdown.push(`Purchase Order ${po.po_number} (${po.vendor?.name}): $${po.total_amount.toFixed(2)}`)
        }
      }

      if (truckInventory && truckInventory.length > 0) {
        for (const item of truckInventory as any[]) {
          const itemCost = item.quantity_used * (item.inventory_item?.unit_price || 0)
          materialsCost += itemCost
          costBreakdown.push(
            `Materials - ${item.inventory_item?.name}: ${item.quantity_used} × $${item.inventory_item?.unit_price || 0} = $${itemCost.toFixed(2)}`
          )
        }
      }

      const subtotal = laborCost + purchaseOrderCost + materialsCost

      const { data: company } = await supabase.from('companies').select('settings').eq('id', profile.company_id).single()
      const taxRate = company?.settings?.tax_rate || 8.5
      const taxAmount = (subtotal * taxRate) / 100
      const totalAmount = subtotal + taxAmount

      const { formattedNumber: invoiceNumber, nextSequence } = await getNextNumber('invoice')

      const notes = [
        `Invoice generated from Work Order ${workOrder.wo_number}`,
        '',
        'Cost Breakdown:',
        ...costBreakdown,
        '',
        `Total: $${subtotal.toFixed(2)}`,
      ].join('\n')

      const invoiceData = {
        company_id: profile.company_id,
        customer_id: workOrder.customer_id,
        work_order_id: workOrder.id,
        invoice_number: invoiceNumber,
        status: 'draft',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: subtotal,
        paid_amount: 0,
        notes,
      }

      const { error: invoiceError } = await supabase.from('invoices').insert([invoiceData]).select().single()
      if (invoiceError) throw invoiceError

      await updateNextNumber('invoice', nextSequence)

      alert(`Invoice ${invoiceNumber} created successfully!\nSubtotal: $${subtotal.toFixed(2)}\nTotal: $${totalAmount.toFixed(2)}`)

      window.dispatchEvent(new CustomEvent('navigate', { detail: 'invoices' }))
    } catch (error: any) {
      console.error('Error creating invoice:', error)
      alert('Error creating invoice: ' + error.message)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile) throw new Error('User profile not found')

      const workOrderData: any = {
        company_id: profile.company_id,
        wo_number: formData.wo_number,
        title: formData.title,
        description: formData.description || null,
        customer_id: formData.customer_id,
        customer_site_id: formData.customer_site_id || null,
        project_id: formData.project_id || null,
        department_id: formData.department_id || null,
        priority: formData.priority,
        status: formData.status,
        scheduled_date: formData.scheduled_date || null,
        work_type: formData.work_type || null,
        notes: formData.notes || null,
      }

      if (editingWorkOrder) {
        const { error } = await supabase.from('work_orders').update(workOrderData).eq('id', editingWorkOrder.id)
        if (error) throw error
      } else {
        const { formattedNumber: woNumber, nextSequence } = await getNextNumber('work_order')
        workOrderData.wo_number = woNumber
        const { error } = await supabase.from('work_orders').insert([workOrderData])
        if (error) throw error
        await updateNextNumber('work_order', nextSequence)
      }

      setShowForm(false)
      setEditingWorkOrder(null)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error('Error saving work order:', error)
      alert('Error saving work order: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      wo_number: '',
      title: '',
      description: '',
      customer_id: '',
      customer_site_id: '',
      project_id: '',
      department_id: '',
      priority: 'medium',
      status: 'open',
      scheduled_date: '',
      work_type: '',
      notes: '',
    })
    setCustomerSites([])
  }

  const startEdit = (workOrder: WorkOrder) => {
    setEditingWorkOrder(workOrder)
    setFormData({
      wo_number: workOrder.wo_number,
      title: workOrder.title,
      description: workOrder.description || '',
      customer_id: workOrder.customer_id,
      customer_site_id: workOrder.customer_site_id || '',
      project_id: workOrder.project_id || '',
      department_id: workOrder.department_id || '',
      priority: workOrder.priority,
      status: workOrder.status,
      scheduled_date: (workOrder as any).scheduled_date || '',
      work_type: workOrder.work_type || '',
      notes: workOrder.notes || '',
    })

    if (workOrder.customer_id) loadCustomerSites(workOrder.customer_id)
    setShowForm(true)
  }

  const deleteWorkOrder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this work order?')) return
    try {
      const { error } = await supabase.from('work_orders').delete().eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting work order:', error)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const updateData: any = { status }
      if (status === 'completed') {
        updateData.completed_date = new Date().toISOString()
      }
      const { error } = await supabase.from('work_orders').update(updateData).eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const openAssignModal = (workOrder: WorkOrder) => {
    setAssigningWorkOrder(workOrder)
    setSelectedTechnicians(workOrder.assignments?.map((a: any) => a.tech_id) || [])
    setPrimaryTechnician(workOrder.assignments?.find((a: any) => a.is_primary)?.tech_id || '')
    setShowAssignModal(true)
  }

  const handleAssignTechnicians = async () => {
    if (!assigningWorkOrder || selectedTechnicians.length === 0) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile) throw new Error('User profile not found')

      await supabase.from('work_order_assignments').delete().eq('work_order_id', assigningWorkOrder.id)

      const assignments = selectedTechnicians.map((techId) => ({
        work_order_id: assigningWorkOrder.id,
        tech_id: techId,
        is_primary: techId === primaryTechnician,
        company_id: profile.company_id,
      }))
      const { error } = await supabase.from('work_order_assignments').insert(assignments)
      if (error) throw error

      setShowAssignModal(false)
      setAssigningWorkOrder(null)
      setSelectedTechnicians([])
      setPrimaryTechnician('')
      loadData()
    } catch (error) {
      console.error('Error assigning technicians:', error)
      alert('Error assigning technicians')
    }
  }

  const saveNotes = async () => {
    if (!selectedWorkOrder) return
    setSavingNotes(true)
    try {
      const { error } = await supabase.from('work_orders').update({ notes: workOrderNotes }).eq('id', selectedWorkOrder.id)
      if (error) throw error
      setWorkOrders((prev) => prev.map((wo) => (wo.id === selectedWorkOrder.id ? { ...wo, notes: workOrderNotes } : wo)))
      alert('Notes saved successfully!')
    } catch (error) {
      console.error('Error saving notes:', error)
      alert('Error saving notes')
    } finally {
      setSavingNotes(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedWorkOrder) return

    setUploadingPhoto(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile) throw new Error('User profile not found')

      const fileExt = file.name.split('.').pop()
      const fileName = `${selectedWorkOrder.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('work-order-photos').upload(fileName, file)
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('work-order-photos').getPublicUrl(fileName)

      const { error: dbError } = await supabase.from('work_order_photos').insert([
        {
          work_order_id: selectedWorkOrder.id,
          company_id: profile.company_id,
          photo_url: publicUrl,
          caption: photoCaption,
          uploaded_by: user.id,
        },
      ])
      if (dbError) throw dbError

      setPhotoCaption('')
      setShowPhotoModal(false)
      loadWorkOrderDetails(selectedWorkOrder.id)
    } catch (error) {
      console.error('Error uploading photo:', error)
      alert('Error uploading photo')
    } finally {
      setUploadingPhoto(false)
      if (e.target) e.target.value = ''
    }
  }

  const startTimer = async () => {
    if (!selectedWorkOrder || !currentUser) return
    try {
      const now = new Date().toISOString()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile) throw new Error('User profile not found')

      const { data, error } = await supabase
        .from('time_entries')
        .insert([
          {
            user_id: user.id,
            company_id: profile.company_id,
            work_order_id: selectedWorkOrder.id,
            start_time: now,
            description: `Working on ${selectedWorkOrder.title}`,
            entry_type: 'work',
            status: 'pending',
          },
        ])
        .select()
        .single()
      if (error) throw error

      setActiveTimer({ id: data.id, start_time: now, work_order_id: selectedWorkOrder.id })
      const interval = setInterval(() => setActiveTimer((prev) => (prev ? { ...prev } : null)), 1000)
      setTimerInterval(interval)
    } catch (error) {
      console.error('Error starting timer:', error)
      alert('Error starting timer')
    }
  }

  const stopTimer = async () => {
    if (!activeTimer) return
    try {
      const now = new Date().toISOString()
      const startTime = new Date(activeTimer.start_time)
      const endTime = new Date(now)
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))

      const { error } = await supabase.from('time_entries').update({ end_time: now, duration_minutes: durationMinutes }).eq('id', activeTimer.id)
      if (error) throw error

      setActiveTimer(null)
      if (timerInterval) {
        clearInterval(timerInterval)
        setTimerInterval(null)
      }
      if (selectedWorkOrder) loadWorkOrderDetails(selectedWorkOrder.id)
    } catch (error) {
      console.error('Error stopping timer:', error)
      alert('Error stopping timer')
    }
  }

  const addTimeEntry = async () => {
    if (!selectedWorkOrder || !currentUser) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile) throw new Error('User profile not found')

      const { error } = await supabase.from('time_entries').insert([
        {
          user_id: user.id,
          company_id: profile.company_id,
          work_order_id: selectedWorkOrder.id,
          start_time: timeFormData.start_time,
          end_time: timeFormData.end_time || null,
          duration_minutes: timeFormData.duration_minutes,
          description: timeFormData.description,
          entry_type: 'work',
          status: 'pending',
        },
      ])
      if (error) throw error

      setShowTimeModal(false)
      setTimeFormData({ start_time: '', end_time: '', description: '', duration_minutes: 0 })
      loadWorkOrderDetails(selectedWorkOrder.id)
    } catch (error) {
      console.error('Error adding time entry:', error)
      alert('Error adding time entry')
    }
  }

  const calculateDuration = () => {
    if (timeFormData.start_time && timeFormData.end_time) {
      const start = new Date(timeFormData.start_time)
      const end = new Date(timeFormData.end_time)
      const diffMins = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
      setTimeFormData((prev) => ({ ...prev, duration_minutes: diffMins }))
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 bg-green-100'
      case 'in_progress':
        return 'text-blue-700 bg-blue-100'
      case 'scheduled':
        return 'text-purple-700 bg-purple-100'
      case 'cancelled':
        return 'text-red-700 bg-red-100'
      case 'open':
        return 'text-yellow-700 bg-yellow-100'
      default:
        return 'text-gray-700 bg-gray-100'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-700 bg-red-100'
      case 'high':
        return 'text-orange-700 bg-orange-100'
      case 'medium':
        return 'text-yellow-700 bg-yellow-100'
      case 'low':
        return 'text-green-700 bg-green-100'
      default:
        return 'text-gray-700 bg-gray-100'
    }
  }

  const filteredWorkOrders = workOrders.filter((wo) => {
    const customerName =
      wo.customer?.customer_type === 'residential'
        ? `${wo.customer?.first_name ?? ''} ${wo.customer?.last_name ?? ''}`.trim()
        : wo.customer?.company_name ?? ''
    const matchesSearch =
      wo.wo_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customerName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !statusFilter || wo.status === statusFilter
    const matchesPriority = !priorityFilter || wo.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })

  if (loading && workOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
        <button
          onClick={() => {
            resetForm()
            setEditingWorkOrder(null)
            setShowForm(true)
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Work Order
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search work orders..."
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
            <option value="open">Open</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <div className="flex justify-end">
            <ViewToggle viewType={viewType} onViewChange={setViewType} />
          </div>
        </div>
      </div>

      {/* Work Orders List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {viewType === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Work Order</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWorkOrders.map((workOrder) => (
                  <tr key={workOrder.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{workOrder.wo_number}</div>
                      <div className="text-sm text-gray-500">{workOrder.title}</div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(workOrder.priority)}`}>
                        {workOrder.priority}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {workOrder.customer?.customer_type === 'residential'
                          ? `${workOrder.customer?.first_name} ${workOrder.customer?.last_name}`
                          : workOrder.customer?.company_name}
                      </div>
                      {workOrder.customer_site && (
                        <div className="text-xs text-gray-500">{workOrder.customer_site.site_name}</div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {workOrder.assignments && (workOrder as any).assignments.length > 0 ? (
                          <div>
                            {(workOrder as any).assignments.map((assignment: any) => (
                              <div key={assignment.id} className="flex items-center">
                                <span className={assignment.is_primary ? 'font-semibold' : ''}>
                                  {assignment.technician?.first_name} {assignment.technician?.last_name}
                                </span>
                                {assignment.is_primary && <span className="ml-1 text-xs text-blue-600">(Primary)</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          'Unassigned'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={workOrder.status}
                        onChange={(e) => updateStatus(workOrder.id, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${getStatusColor(workOrder.status)}`}
                        disabled={currentUser?.profile?.role === 'tech'}
                      >
                        <option value="open">Open</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(workOrder as any).scheduled_date ? new Date((workOrder as any).scheduled_date).toLocaleDateString() : 'Not scheduled'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedWorkOrder(workOrder)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(currentUser?.profile?.role === 'admin' ||
                          currentUser?.profile?.role === 'manager' ||
                          currentUser?.profile?.role === 'office') && (
                          <>
                            <button
                              onClick={() => openAssignModal(workOrder)}
                              className="text-purple-600 hover:text-purple-800 p-1.5 transition-all duration-200 hover:bg-purple-100 rounded-full hover:shadow-sm transform hover:scale-110"
                              title="Assign Technicians"
                            >
                              <Users className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCreateInvoice(workOrder)}
                              className="text-green-600 hover:text-green-800 p-1.5 transition-all duration-200 hover:bg-green-100 rounded-full hover:shadow-sm transform hover:scale-110"
                              title="Create Invoice"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => startEdit(workOrder)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm transform hover:scale-110"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteWorkOrder(workOrder.id)}
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
              {filteredWorkOrders.map((workOrder) => (
                <div key={workOrder.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{workOrder.wo_number}</h3>
                      <p className="text-sm text-gray-600 mb-2">{workOrder.title}</p>
                      <div className="flex space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workOrder.status)}`}>
                          {workOrder.status.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(workOrder.priority)}`}>
                          {workOrder.priority.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="w-4 h-4 mr-3" />
                      <span>
                        {workOrder.customer?.customer_type === 'residential'
                          ? `${workOrder.customer?.first_name} ${workOrder.customer?.last_name}`
                          : workOrder.customer?.company_name}
                      </span>
                    </div>

                    {workOrder.customer_site && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Building2 className="w-4 h-4 mr-3" />
                        <span>{workOrder.customer_site.site_name}</span>
                      </div>
                    )}

                    {(workOrder as any).scheduled_date && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-3" />
                        <span>{new Date((workOrder as any).scheduled_date).toLocaleDateString()}</span>
                      </div>
                    )}

                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-3" />
                      <span>
                        {(workOrder as any).assignments && (workOrder as any).assignments.length > 0
                          ? `${(workOrder as any).assignments.length} technician${(workOrder as any).assignments.length > 1 ? 's' : ''}`
                          : 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-500">{(workOrder as any).project && `Project: ${(workOrder as any).project.project_name}`}</div>
                    <button onClick={() => setSelectedWorkOrder(workOrder)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      View Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Work Order Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{editingWorkOrder ? 'Edit Work Order' : 'Create New Work Order'}</h3>
                <div className="text-sm text-blue-600 font-medium">WO Number: {formData.wo_number}</div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* ... form fields unchanged ... */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {loading ? 'Saving...' : editingWorkOrder ? 'Update Work Order' : 'Create Work Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && assigningWorkOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          {/* ... unchanged ... */}
        </div>
      )}

      {/* Work Order Detail Modal */}
      {selectedWorkOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Work Order {selectedWorkOrder.wo_number}</h3>
                <div className="flex items-center space-x-3">
                  {(currentUser?.profile?.role === 'admin' ||
                    currentUser?.profile?.role === 'manager' ||
                    currentUser?.profile?.role === 'office') && (
                    <button onClick={() => handleCreateInvoice(selectedWorkOrder)} className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Create Invoice
                    </button>
                  )}
                  <button onClick={() => setSelectedWorkOrder(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left column unchanged ... */}

                {/* Right Column - Activities */}
                <div className="space-y-6">
                  {/* Notes & Photos unchanged ... */}

                  {/* Purchase Orders */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-gray-900">Purchase Orders ({purchaseOrders.length})</h4>
                      <button
                        type="button"
                        onClick={() => gotoPurchaseOrdersFromWO(selectedWorkOrder)}
                        className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create PO
                      </button>
                    </div>
                    {purchaseOrders.length > 0 ? (
                      <div className="space-y-3">
                        {purchaseOrders.map((po: any) => (
                          <div key={po.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{po.po_number}</p>
                              <p className="text-xs text-gray-500">{po.vendor?.name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">${po.total_amount.toFixed(2)}</p>
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  po.status === 'approved'
                                    ? 'text-blue-700 bg-blue-100'
                                    : po.status === 'received'
                                    ? 'text-green-700 bg-green-100'
                                    : 'text-yellow-700 bg-yellow-100'
                                }`}
                              >
                                {po.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No purchase orders</p>
                    )}
                  </div>

                  {/* Truck Inventory & Time Tracking unchanged ... */}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Modal & Time Entry Modal unchanged ... */}
    </div>
  )
}
