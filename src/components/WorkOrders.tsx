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

/** Helpful globals so TS doesn't complain if these exist in your app */
declare global {
  interface Window {
    router?: { navigate?: (to: string) => void; push?: (to: string) => void; replace?: (to: string) => void }
    goTo?: (to: string) => void
    appNavigate?: (to: string) => void
    openPOCreate?: (payload: any) => void
  }
}

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

  // =========================
  // Purchase Order Helpers
  // =========================

  /** Build a compact payload the PO page can use to prefill the creation table */
  const buildPOPrefill = (wo: WorkOrder) => {
    const customerName =
      wo.customer?.customer_type === 'residential'
        ? `${wo.customer?.first_name ?? ''} ${wo.customer?.last_name ?? ''}`.trim()
        : wo.customer?.company_name ?? ''

    return {
      kind: 'po:create_from_work_order',
      ts: Date.now(),
      work_order: {
        id: wo.id,
        wo_number: wo.wo_number,
        title: wo.title,
        customer_id: wo.customer_id,
        customer_site_id: (wo as any).customer_site_id || null,
        project_id: (wo as any).project_id || null,
        department_id: (wo as any).department_id || null,
        customer_display: customerName,
      },
    }
  }

  /** Persist to localStorage (also fires a "storage" event for cross-tab listeners) */
  const persistPOPrefill = (payload: any) => {
    try {
      localStorage.setItem('po_prefill_from_wo', JSON.stringify(payload))
      // ping listeners that rely on a fresh key to trigger
      localStorage.setItem('po_create_ping', JSON.stringify({ ts: Date.now() }))
    } catch (e) {
      console.warn('Failed to persist PO prefill payload', e)
    }
  }

  /** Broadcast multiple event shapes to maximize compatibility with your app’s bus */
  const broadcastPOCreate = (payload: any) => {
    const events = [
      new CustomEvent('po:create', { detail: payload }),
      new CustomEvent('purchase-orders:create', { detail: payload }),
      new CustomEvent('po:new', { detail: payload }),
      new CustomEvent('navigate', { detail: 'purchase-orders' }),
      new CustomEvent('navigate', { detail: { page: 'purchase-orders', action: 'create', payload } }),
      new CustomEvent('app:navigate', { detail: { to: 'purchase-orders', action: 'create', payload } }),
    ]

    for (const evt of events) {
      try {
        window.dispatchEvent(evt)
      } catch {}
      try {
        document.dispatchEvent(evt)
      } catch {}
    }

    // if a global hook exists, call it
    try {
      window.openPOCreate?.(payload)
    } catch {}
  }

  /** Try several navigation fallbacks commonly used in SPAs */
  const navigateToPurchaseOrders = () => {
    try {
      // Most custom routers
      window.router?.navigate?.('/purchase-orders/new')
      window.router?.navigate?.('/purchase-orders')
      window.router?.push?.('/purchase-orders/new')
      window.router?.replace?.('/purchase-orders/new')
    } catch {}

    try {
      window.goTo?.('purchase-orders')
      window.appNavigate?.('purchase-orders')
    } catch {}

    // Hash-router fallback
    try {
      if (window?.history?.pushState) {
        const target = /\/purchase-orders/.test(location.hash) ? location.hash : '#/purchase-orders'
        window.history.pushState({}, '', target)
      } else {
        window.location.hash = '#/purchase-orders'
      }
    } catch {}

    // Last-resort hard change that still stays in-app if your router handles the path
    try {
      if (!/purchase-orders/.test(window.location.href)) {
        window.location.assign('#/purchase-orders')
      }
    } catch {}
  }

  /** Close the modal, then persist + broadcast + navigate */
  const handleCreatePOClick = () => {
    if (!selectedWorkOrder) return
    const payload = buildPOPrefill(selectedWorkOrder)

    // 1) close the overlay first (prevents focus traps from blocking route change)
    setSelectedWorkOrder(null)

    // 2) after the modal unmounts, fire everything
    setTimeout(() => {
      console.info('[WO] Requesting PO create with payload:', payload)
      persistPOPrefill(payload)
      broadcastPOCreate(payload)
      navigateToPurchaseOrders()
    }, 0)
  }

  // =========================
  // Data & UI logic
  // =========================

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
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
      setFormData((prev) => ({ ...prev, wo_number: woNumber }))
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
            `Labor - ${entry.user.first_name} ${entry.user.last_name}: ${hours.toFixed(1)}h × $${hourlyRate}/h = $${entryCost.toFixed(2)}`
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

      alert(
        `Invoice ${invoiceNumber} created successfully!\nSubtotal: $${subtotal.toFixed(2)}\nTotal: $${totalAmount.toFixed(2)}`
      )

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
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
      customer_site_id: (workOrder as any).customer_site_id || '',
      project_id: (workOrder as any).project_id || '',
      department_id: (workOrder as any).department_id || '',
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
    setSelectedTechnicians((workOrder as any).assignments?.map((a: any) => a.tech_id) || [])
    setPrimaryTechnician((workOrder as any).assignments?.find((a: any) => a.is_primary)?.tech_id || '')
    setShowAssignModal(true)
  }

  const handleAssignTechnicians = async () => {
    if (!assigningWorkOrder || selectedTechnicians.length === 0) return

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
                        {(workOrder as any).assignments && (workOrder as any).assignments.length > 0 ? (
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer *</label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customer_type === 'residential' ? `${c.first_name} ${c.last_name}` : c.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Site</label>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
                  <select
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No Project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.project_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="open">Open</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Date</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Work Type</label>
                  <input
                    type="text"
                    value={formData.work_type}
                    onChange={(e) => setFormData({ ...formData, work_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Installation, Maintenance, Repair"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Assign Technicians to {assigningWorkOrder.wo_number}</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Select Technicians</label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {technicians.map((tech) => (
                    <div key={tech.id} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`tech-${tech.id}`}
                        checked={selectedTechnicians.includes(tech.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTechnicians([...selectedTechnicians, tech.id])
                          } else {
                            setSelectedTechnicians(selectedTechnicians.filter((id) => id !== tech.id))
                            if (primaryTechnician === tech.id) setPrimaryTechnician('')
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`tech-${tech.id}`} className="ml-2 block text-sm text-gray-900">
                        {tech.first_name} {tech.last_name} ({tech.role})
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTechnicians.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Primary Technician</label>
                  <select
                    value={primaryTechnician}
                    onChange={(e) => setPrimaryTechnician(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Primary</option>
                    {selectedTechnicians.map((techId) => {
                      const tech = technicians.find((t) => t.id === techId)
                      return (
                        <option key={techId} value={techId}>
                          {tech?.first_name} {tech?.last_name}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button onClick={handleAssignTechnicians} disabled={selectedTechnicians.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  Assign Technicians
                </button>
              </div>
            </div>
          </div>
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
                {/* Left Column */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Work Order Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Title:</span>
                        <span className="text-sm text-gray-900">{selectedWorkOrder.title}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Status:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedWorkOrder.status)}`}>
                          {selectedWorkOrder.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Priority:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedWorkOrder.priority)}`}>
                          {selectedWorkOrder.priority.toUpperCase()}
                        </span>
                      </div>
                      {(selectedWorkOrder as any).scheduled_date && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Scheduled:</span>
                          <span className="text-sm text-gray-900">{new Date((selectedWorkOrder as any).scheduled_date).toLocaleString()}</span>
                        </div>
                      )}
                      {selectedWorkOrder.work_type && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Work Type:</span>
                          <span className="text-sm text-gray-900">{selectedWorkOrder.work_type}</span>
                        </div>
                      )}
                    </div>

                    {selectedWorkOrder.description && (
                      <div className="mt-6">
                        <h5 className="text-md font-medium text-gray-900 mb-3">Description</h5>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm text-gray-700">{selectedWorkOrder.description}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Customer Information */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Customer:</span>
                        <span className="text-sm text-gray-900">
                          {selectedWorkOrder.customer?.customer_type === 'residential'
                            ? `${selectedWorkOrder.customer?.first_name} ${selectedWorkOrder.customer?.last_name}`
                            : selectedWorkOrder.customer?.company_name}
                        </span>
                      </div>
                      {selectedWorkOrder.customer_site && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Site:</span>
                          <span className="text-sm text-gray-900">{selectedWorkOrder.customer_site.site_name}</span>
                        </div>
                      )}
                      {selectedWorkOrder.customer?.email && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Email:</span>
                          <span className="text-sm text-gray-900">{selectedWorkOrder.customer.email}</span>
                        </div>
                      )}
                      {selectedWorkOrder.customer?.phone && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-700">Phone:</span>
                          <span className="text-sm text-gray-900">{selectedWorkOrder.customer.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Assigned Technicians */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Assigned Technicians</h4>
                    {(selectedWorkOrder as any).assignments && (selectedWorkOrder as any).assignments.length > 0 ? (
                      <div className="space-y-2">
                        {(selectedWorkOrder as any).assignments.map((assignment: any) => (
                          <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {assignment.technician?.first_name} {assignment.technician?.last_name}
                                </p>
                                <p className="text-xs text-gray-500">{assignment.technician?.role}</p>
                              </div>
                            </div>
                            {assignment.is_primary && (
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full text-blue-700 bg-blue-100">Primary</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No technicians assigned</p>
                    )}
                  </div>
                </div>

                {/* Right Column - Activities */}
                <div className="space-y-6">
                  {/* Notes */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-gray-900">Notes</h4>
                      <button onClick={saveNotes} disabled={savingNotes} className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm">
                        {savingNotes ? 'Saving...' : 'Save Notes'}
                      </button>
                    </div>
                    <textarea
                      value={workOrderNotes}
                      onChange={(e) => setWorkOrderNotes(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Add notes about this work order..."
                    />
                  </div>

                  {/* Photos */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-gray-900">Photos ({workOrderPhotos.length})</h4>
                      <button onClick={() => setShowPhotoModal(true)} className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                        <Camera className="w-4 h-4 mr-2" />
                        Add Photo
                      </button>
                    </div>
                    {workOrderPhotos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {workOrderPhotos.map((photo) => (
                          <div key={photo.id} className="relative">
                            <img src={photo.photo_url} alt={photo.caption || 'Work order photo'} className="w-full h-32 object-cover rounded-lg border border-gray-200" />
                            {photo.caption && <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2 rounded-b-lg">{photo.caption}</div>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No photos uploaded</p>
                    )}
                  </div>

                  {/* Purchase Orders */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-gray-900">Purchase Orders ({purchaseOrders.length})</h4>
                      <button
                        type="button"
                        onClick={handleCreatePOClick}
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

                  {/* Truck Inventory */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-gray-900">Truck Inventory ({truckInventory.length})</h4>
                      <button className="inline-flex items-center px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm">
                        <Package className="w-4 h-4 mr-2" />
                        Add Item
                      </button>
                    </div>
                    {truckInventory.length > 0 ? (
                      <div className="space-y-3">
                        {truckInventory.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{item.inventory_item?.name}</p>
                              <p className="text-xs text-gray-500">SKU: {item.inventory_item?.sku || 'N/A'}</p>
                              <p className="text-xs text-gray-500">Quantity Used: {item.quantity_used}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                ${((item.inventory_item?.unit_price || 0) * item.quantity_used).toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500">${(item.inventory_item?.unit_price || 0).toFixed(2)} each</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                          <span className="text-sm font-medium text-gray-700">Total Materials Cost:</span>
                          <span className="text-lg font-bold text-green-600">
                            $
                            {truckInventory
                              .reduce((sum: number, item: any) => sum + (item.inventory_item?.unit_price || 0) * item.quantity_used, 0)
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No materials used</p>
                    )}
                  </div>

                  {/* Time Tracking */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-gray-900">Time Tracking ({timeEntries.length})</h4>
                      <div className="flex space-x-2">
                        {!activeTimer ? (
                          <button onClick={startTimer} className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
                            <Play className="w-4 h-4 mr-2" />
                            Start Timer
                          </button>
                        ) : (
                          <button onClick={stopTimer} className="inline-flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">
                            <Square className="w-4 h-4 mr-2" />
                            Stop Timer
                          </button>
                        )}
                        <button onClick={() => setShowTimeModal(true)} className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                          <Clock className="w-4 h-4 mr-2" />
                          Add Time
                        </button>
                      </div>
                    </div>

                    {activeTimer && (
                      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-green-800">Timer Running</span>
                          <span className="text-sm text-green-600">Started: {new Date(activeTimer.start_time).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    )}

                    {timeEntries.length > 0 ? (
                      <div className="space-y-3">
                        {timeEntries.map((entry: any) => (
                          <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{formatDuration(entry.duration_minutes)}</p>
                              <p className="text-xs text-gray-500">
                                {entry.user?.first_name} {entry.user?.last_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(entry.start_time).toLocaleDateString()} - {new Date(entry.start_time).toLocaleTimeString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  entry.status === 'approved'
                                    ? 'text-green-700 bg-green-100'
                                    : entry.status === 'rejected'
                                    ? 'text-red-700 bg-red-100'
                                    : 'text-yellow-700 bg-yellow-100'
                                }`}
                              >
                                {entry.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No time entries</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add Photo</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={uploadingPhoto}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Caption (Optional)</label>
                <input
                  type="text"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe this photo..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button onClick={() => setShowPhotoModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Entry Modal */}
      {showTimeModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add Time Entry</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                <input
                  type="datetime-local"
                  value={timeFormData.start_time}
                  onChange={(e) => setTimeFormData({ ...timeFormData, start_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={timeFormData.end_time}
                  onChange={(e) => setTimeFormData({ ...timeFormData, end_time: e.target.value })}
                  onBlur={calculateDuration}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  value={timeFormData.duration_minutes}
                  onChange={(e) => setTimeFormData({ ...timeFormData, duration_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min={1}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={timeFormData.description}
                  onChange={(e) => setTimeFormData({ ...timeFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  required
                  placeholder="Describe the work performed..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button onClick={() => setShowTimeModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button onClick={addTimeEntry} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Add Time Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
