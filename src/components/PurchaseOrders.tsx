import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, Search, DollarSign, Calendar, User, FileText,
  Edit, Trash2, Eye, X
} from 'lucide-react'
import { supabase, Customer } from '../lib/supabase'
import { useViewPreference } from '../hooks/useViewPreference'
import ViewToggle from './ViewToggle'
import { getNextNumber, updateNextNumber } from '../lib/numbering'

interface PurchaseOrdersProps {
  selectedRecordId?: string | null
  onRecordViewed?: () => void
}

type POStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled'

interface PurchaseOrder {
  id: string
  company_id: string
  vendor_id: string
  work_order_id?: string | null
  po_number: string
  status: POStatus | null // tolerate bad/legacy data
  order_date: string | null
  expected_date?: string | null
  subtotal: number | null
  tax_rate: number | null
  tax_amount: number | null
  total_amount: number | null
  paid_amount: number | null
  payment_date?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  vendor?: any
  customer?: Customer
  work_order?: {
    wo_number: string
    title: string
  }
}

type PrefillPayload = {
  kind?: string
  ts?: number
  work_order?: {
    id?: string
    wo_number?: string
    title?: string
    customer_id?: string
    customer_site_id?: string | null
    project_id?: string | null
    department_id?: string | null
    customer_display?: string
  }
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const statusLook: Record<POStatus, { label: string; badge: string; dot: string; row: string; chip: string }> = {
  draft: {
    label: 'Draft',
    badge: 'text-gray-700 bg-gray-100 ring-1 ring-gray-200',
    dot: 'bg-gray-400',
    row: 'hover:bg-gray-50',
    chip: 'bg-gray-100 text-gray-700 border border-gray-200'
  },
  ordered: {
    label: 'Ordered',
    badge: 'text-blue-700 bg-blue-50 ring-1 ring-blue-200',
    dot: 'bg-blue-500',
    row: 'hover:bg-blue-50/60',
    chip: 'bg-blue-50 text-blue-700 border border-blue-200'
  },
  partially_received: {
    label: 'Partially received',
    badge: 'text-amber-800 bg-amber-50 ring-1 ring-amber-200',
    dot: 'bg-amber-500',
    row: 'hover:bg-amber-50/60',
    chip: 'bg-amber-50 text-amber-800 border border-amber-200'
  },
  received: {
    label: 'Received',
    badge: 'text-green-800 bg-green-50 ring-1 ring-green-200',
    dot: 'bg-green-500',
    row: 'hover:bg-green-50/60',
    chip: 'bg-green-50 text-green-800 border border-green-200'
  },
  cancelled: {
    label: 'Cancelled',
    badge: 'text-rose-800 bg-rose-50 ring-1 ring-rose-200',
    dot: 'bg-rose-500',
    row: 'hover:bg-rose-50/60',
    chip: 'bg-rose-50 text-rose-800 border border-rose-200'
  },
}

// ---------- small helpers (null-safe) ----------
const normalizeStatus = (s: any): POStatus =>
  s === 'draft' || s === 'ordered' || s === 'partially_received' || s === 'received' || s === 'cancelled' ? s : 'draft'

const numToStr = (n: any, fallback = 0) => String(n ?? fallback)
const toISODateInput = (d?: string | null) => {
  if (!d) return ''
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10)
}
const safeDateOrToday = (d?: string | null) =>
  toISODateInput(d) || new Date().toISOString().slice(0, 10)

// Detect Postgres CHECK-constraint error
const isStatusConstraintError = (err: any) => {
  const code = err?.code || err?.error?.code
  const body = typeof err?.body === 'string' ? err.body : JSON.stringify(err?.body || {})
  const msg = (err?.message || err?.error?.message || body || '').toLowerCase()
  return code === '23514' || msg.includes('status_check') || msg.includes('check constraint')
}

// Detect PostgREST "column missing in schema cache"
const isMissingColumnError = (err: any, col: string) => {
  const code = err?.code || err?.error?.code
  const body = typeof err?.body === 'string' ? err.body : JSON.stringify(err?.body || '')
  const msg = (err?.message || err?.error?.message || body || '').toLowerCase()
  return code === 'PGRST204' || msg.includes(`'${col.toLowerCase()}'`) || msg.includes('schema cache')
}

const ALL_STATUSES: POStatus[] = ['draft','ordered','partially_received','received','cancelled']

export default function PurchaseOrders({ selectedRecordId, onRecordViewed }: PurchaseOrdersProps = {}) {
  const { viewType, setViewType } = useViewPreference('purchase_orders')
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])

  const [pos, setPOs] = useState<PurchaseOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredWorkOrders, setFilteredWorkOrders] = useState<WorkOrder[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<POStatus | ''>('')
  const [customerFilter, setCustomerFilter] = useState('')

  const [numberingError, setNumberingError] = useState<string>('') 
  const [allowManualNumber, setAllowManualNumber] = useState(false)

  const [supportsPartialStatus, setSupportsPartialStatus] = useState<boolean>(() => {
    return localStorage.getItem('po_supports_partial') !== '0'
  })

  const [blockedStatuses, setBlockedStatuses] = useState<POStatus[]>(() => {
    try { return JSON.parse(localStorage.getItem('po_blocked_statuses') || '[]') }
    catch { return [] }
  })
  const saveBlocked = (arr: POStatus[]) => {
    setBlockedStatuses(arr)
    localStorage.setItem('po_blocked_statuses', JSON.stringify(arr))
  }

  const [hasPaymentDate, setHasPaymentDate] = useState<boolean>(() => {
    return localStorage.getItem('po_has_payment_date') !== '0'
  })
  const markNoPaymentDate = () => {
    setHasPaymentDate(false)
    localStorage.setItem('po_has_payment_date', '0')
  }

  const allowStatus = (s: POStatus) =>
    (supportsPartialStatus || s !== 'partially_received') && !blockedStatuses.includes(s)

  const [formData, setFormData] = useState({
    po_number: '',
    vendor_id: '',
    customer_id: '',
    work_order_id: '',
    status: 'draft' as POStatus,
    order_date: new Date().toISOString().slice(0, 10),
    expected_date: '',
    subtotal: '',
    tax_rate: '0',
    notes: ''
  })

  // --- helpers for URL handling & one-time prefill consumption
  const hasConsumedStoragePrefillRef = useRef(false)
  const suppressUrlCreateRef = useRef(false)

  const parseQuery = (): URLSearchParams => {
    try {
      const search = window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '')
      return new URLSearchParams(search)
    } catch {
      return new URLSearchParams()
    }
  }

  const clearPOCreateSignals = () => {
    try {
      localStorage.removeItem('po_prefill_from_wo')
      const href = window.location.href
      const url = new URL(href)
      url.searchParams.delete('create')
      url.searchParams.delete('wo')

      const [hashBase, hashQuery] = (url.hash || '').split('?')
      const cleanedHash = hashBase || ''
      const cleaned =
        `${url.origin}${url.pathname}` +
        (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') +
        cleanedHash
      window.history.replaceState({}, '', cleaned)

      if (hashQuery) {
        const params = new URLSearchParams(hashQuery)
        params.delete('create')
        params.delete('wo')
        const newHash = cleanedHash + (params.toString() ? `?${params.toString()}` : '')
        if (newHash !== window.location.hash) window.location.hash = newHash
      }
    } catch {}
  }

  const findWorkOrderByNumber = (woNumber: string) => {
    const term = woNumber.trim().toLowerCase()
    return workOrders.find((wo) => String(wo.wo_number || '').toLowerCase() === term)
  }

  const consumeLocalStoragePrefill = (): PrefillPayload | null => {
    try {
      const raw = localStorage.getItem('po_prefill_from_wo')
      if (!raw) return null
      const parsed = JSON.parse(raw) as PrefillPayload
      localStorage.removeItem('po_prefill_from_wo')
      return parsed
    } catch {
      return null
    }
  }

  // --- data
  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // Filter work orders based on selected customer
    if (formData.customer_id) {
      const filtered = workOrders.filter(wo => wo.customer_id === formData.customer_id)
      setFilteredWorkOrders(filtered)
      // Clear work order selection if it's not for the selected customer
      if (formData.work_order_id) {
        const selectedWO = workOrders.find(wo => wo.id === formData.work_order_id)
        if (selectedWO && selectedWO.customer_id !== formData.customer_id) {
          setFormData(prev => ({ ...prev, work_order_id: '' }))
        }
      }
    } else {
      setFilteredWorkOrders(workOrders)
    }
  }, [formData.customer_id, workOrders, formData.work_order_id])

  useEffect(() => {
    // Auto-open detail modal if selectedRecordId is provided
    if (selectedRecordId && purchaseOrders.length > 0) {
      const purchaseOrder = purchaseOrders.find(po => po.id === selectedRecordId)
      if (purchaseOrder) {
        setSelectedPO(purchaseOrder)
        onRecordViewed?.()
      }
    }
  }, [selectedRecordId, purchaseOrders, onRecordViewed])

  useEffect(() => {
    // Auto-open detail modal if selectedRecordId is provided
    if (selectedRecordId && purchaseOrders.length > 0) {
      const purchaseOrder = purchaseOrders.find(po => po.id === selectedRecordId)
      if (purchaseOrder) {
        setSelectedPO(purchaseOrder)
        onRecordViewed?.()
      }
    }
  }, [selectedRecordId, purchaseOrders, onRecordViewed])

  const loadData = async () => {
    let posResult, vendorsResult, workOrdersResult, customersResult
    
    try {
      [posResult, vendorsResult, workOrdersResult, customersResult] = await Promise.all([
        supabase.from('purchase_orders').select(`
          *,
          vendor:vendors(*),
          work_order:work_orders(
            wo_number,
            title,
            customer:customers(*)
          )
        `).order('created_at', { ascending: false }),
        supabase.from('vendors').select('*').order('name'),
        supabase
          .from('work_orders')
          .select('*')
          .order('wo_number'),
        supabase
          .from('customers')
          .select('*')
          .order('first_name')
      ])

      setPurchaseOrders(posResult.data || [])
      const processedPOs = (posResult.data || []).map((p: any) => ({
        ...p,
        status: normalizeStatus(p.status),
        subtotal: p.subtotal ?? 0,
        tax_rate: p.tax_rate ?? 0,
        tax_amount: p.tax_amount ?? 0,
        total_amount: p.total_amount ?? 0,
        paid_amount: p.paid_amount ?? 0,
        order_date: p.order_date ?? null,
        expected_date: p.expected_date ?? null,
        customer: p.work_order?.customer
      }))

      setPOs(processedPOs)
      setVendors(vendorsResult.data || [])
      setCustomers(customersResult.data || [])
      setWorkOrders(workOrdersResult.data || [])
      setCustomers(customersResult.data || [])
      setFilteredWorkOrders(workOrdersResult.data || [])
    } catch (e) {
      console.error('Error loading POs:', e)
    } finally {
      setLoading(false)
    }
  }

  // --- numbering
  useEffect(() => {
    if (showForm && !editingPO) generatePONumber()
  }, [showForm, editingPO])

  const generatePONumber = async () => {
    setNumberingError('')
    setAllowManualNumber(false)
    try {
      const { formattedNumber } = await getNextNumber('purchase_order')
      setFormData(prev => ({ ...prev, po_number: formattedNumber }))
    } catch (e: any) {
      console.error('Error generating PO number:', e)
      setNumberingError(e?.message || 'Unable to generate PO number from settings.')
      setAllowManualNumber(true)
    }
  }

  // --- INCOMING CREATE REQUESTS
  const prefillFromWorkOrder = (wo: { id?: string; wo_number?: string; title?: string } | null | undefined) => {
    setEditingPO(null)
    setShowForm(true)
    setAllowManualNumber(false)
    const defaultNote = wo?.wo_number
      ? `Created from Work Order ${wo.wo_number}${wo?.title ? ` — ${wo.title}` : ''}`
      : (formData.notes || '')
    setFormData(prev => ({
      ...prev,
      work_order_id: (wo?.id as string) || '',
      notes: prev.notes || defaultNote
    }))
  }

  const handlePOCreatePayload = (payload: PrefillPayload | null) => {
    if (!payload?.work_order) {
      setEditingPO(null)
      setShowForm(true)
      return
    }
    prefillFromWorkOrder(payload.work_order)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (suppressUrlCreateRef.current) {
      suppressUrlCreateRef.current = false
      return
    }
    if (!hasConsumedStoragePrefillRef.current) {
      const initialPayload = consumeLocalStoragePrefill()
      if (initialPayload) {
        hasConsumedStoragePrefillRef.current = true
        handlePOCreatePayload(initialPayload)
      }
    }
    const params = parseQuery()
    const wantsCreate = params.get('create') === '1'
    const woParam = (params.get('wo') || '').trim()
    if (wantsCreate && !showForm && !editingPO) {
      if (woParam && workOrders.length > 0) {
        const match = findWorkOrderByNumber(woParam)
        prefillFromWorkOrder(match || { wo_number: woParam })
      } else {
        setEditingPO(null)
        setShowForm(true)
      }
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'po_create_ping') {
        const payload = consumeLocalStoragePrefill()
        if (payload) handlePOCreatePayload(payload)
      }
    }
    const onPOCreateEvent = (evt: Event) => {
      try {
        // @ts-ignore
        const detail = (evt as CustomEvent)?.detail as PrefillPayload | undefined
        handlePOCreatePayload(detail || null)
      } catch {
        handlePOCreatePayload(null)
      }
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('po:create', onPOCreateEvent as EventListener)
    window.addEventListener('purchase-orders:create', onPOCreateEvent as EventListener)
    window.addEventListener('po:new', onPOCreateEvent as EventListener)
    document.addEventListener('po:create', onPOCreateEvent as EventListener)
    document.addEventListener('purchase-orders:create', onPOCreateEvent as EventListener)
    document.addEventListener('po:new', onPOCreateEvent as EventListener)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('po:create', onPOCreateEvent as EventListener)
      window.removeEventListener('purchase-orders:create', onPOCreateEvent as EventListener)
      window.removeEventListener('po:new', onPOCreateEvent as EventListener)
      document.removeEventListener('po:create', onPOCreateEvent as EventListener)
      document.removeEventListener('purchase-orders:create', onPOCreateEvent as EventListener)
      document.removeEventListener('po:new', onPOCreateEvent as EventListener)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrders.length, showForm, editingPO])

  // --- form actions
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
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

      const poData: any = {
        company_id: profile.company_id,
        vendor_id: formData.vendor_id,
        work_order_id: formData.work_order_id || null,
        po_number: formData.po_number, // may be replaced for new creates
        status: formData.status,
        order_date: formData.order_date,
        expected_date: formData.expected_date || null,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        paid_amount: 0,
        notes: formData.notes || null
      }

      if (editingPO) {
        const { error } = await supabase.from('purchase_orders')
          .update(poData)
          .eq('id', editingPO.id)
        if (error) throw error
      } else {
        // re-read number at submit-time to avoid collisions
        let formattedNumber = formData.po_number
        let nextSequence: number | null = null

        if (!allowManualNumber) {
          const res = await getNextNumber('purchase_order')
          formattedNumber = res.formattedNumber
          nextSequence = res.nextSequence
        } else if (!formattedNumber) {
          throw new Error('PO Number is required.')
        }

        poData.po_number = formattedNumber
        const { error } = await supabase.from('purchase_orders').insert([poData])
        if (error) throw error
        if (nextSequence) await updateNextNumber('purchase_order', nextSequence)
      }

      clearPOCreateSignals()
      setShowForm(false)
      setEditingPO(null)
      resetForm()
      loadData()
    } catch (e: any) {
      console.error('Error saving PO:', e)
      alert('Error saving purchase order: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const onCancelForm = () => {
    suppressUrlCreateRef.current = true
    setShowForm(false)
    setEditingPO(null)
    resetForm()
    clearPOCreateSignals()
  }

  const resetForm = () => {
    setFormData({
      po_number: '',
      vendor_id: '',
      customer_id: '',
      work_order_id: '',
      status: 'draft',
      order_date: new Date().toISOString().slice(0, 10),
      expected_date: '',
      subtotal: '',
      tax_rate: '0',
      notes: ''
    })
    setNumberingError('')
    setAllowManualNumber(false)
  }

  // --- bulletproof edit opener (null-safe & race-free)
  const startEdit = (po?: PurchaseOrder | null) => {
    if (!po) {
      console.warn('startEdit called without a PO')
      return
    }
    // close detail first (if open)
    setSelectedPO(null)
    // fill form with null-safe conversions
    setEditingPO(po)
    
    // Get customer_id from the associated work order
    const associatedWorkOrder = workOrders.find(wo => wo.id === po.work_order_id)
    const customerId = associatedWorkOrder?.customer_id || ''
    
    setFormData({
      po_number: String(po.po_number ?? ''),
      customer_id: customerId,
      vendor_id: String(po.vendor_id ?? ''),
      work_order_id: po.work_order_id ?? '',
      status: normalizeStatus(po.status),
      order_date: safeDateOrToday(po.order_date),
      expected_date: toISODateInput(po.expected_date),
      subtotal: numToStr(po.subtotal, 0),
      tax_rate: numToStr(po.tax_rate, 0),
      notes: po.notes ?? ''
    })
    setNumberingError('')
    setAllowManualNumber(true)
    // open on next frame to avoid any race with the detail modal unmount
    requestAnimationFrame(() => setShowForm(true))
  }

  const deletePO = async (id: string) => {
    if (!confirm('Delete this purchase order?')) return
    try {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
      if (error) throw error
      loadData()
    } catch (e) {
      console.error('Error deleting PO:', e)
    }
  }

  // Persist status with rollback, constraint awareness, and payment_date fallback
  const persistStatus = async (id: string, next: POStatus, previous: POStatus) => {
    let updateData: any = { status: next }
    if (next === 'received' && hasPaymentDate) {
      updateData.payment_date = new Date().toISOString().slice(0, 10)
    }

    let { error } = await supabase.from('purchase_orders').update(updateData).eq('id', id)

    // If schema cache doesn't have 'payment_date', retry without it and remember
    if (error && isMissingColumnError(error, 'payment_date') && 'payment_date' in updateData) {
      markNoPaymentDate()
      const retry = await supabase.from('purchase_orders').update({ status: next }).eq('id', id)
      error = retry.error
    }

    if (error) {
      // Roll back optimistic UI
      setPOs(list => list.map(p => (p.id === id ? { ...p, status: previous } : p)))

      if (isStatusConstraintError(error)) {
        if (next === 'partially_received') {
          setSupportsPartialStatus(false)
          localStorage.setItem('po_supports_partial', '0')
        }
        if (!blockedStatuses.includes(next)) {
          const updated = [...blockedStatuses, next]
          saveBlocked(updated)
        }
        alert(`Your database constraint doesn't allow status "${statusLook[next].label}". I've hidden it in the UI.`)
        return
      }

      alert('Could not update status: ' + (error.message || 'Unknown error'))
    }
  }

  // --- derived values / UI helpers
  const getBadge = (status: POStatus | null | undefined) => statusLook[normalizeStatus(status)].badge
  const getDot = (status: POStatus | null | undefined) => statusLook[normalizeStatus(status)].dot
  const getRowAccent = (status: POStatus | null | undefined) => statusLook[normalizeStatus(status)].row
  const getChip = (status: POStatus) => statusLook[status].chip
  const labelFor = (status: POStatus | null | undefined) => statusLook[normalizeStatus(status)].label

  const initials = (name?: string) =>
    (name || '')
      .split(' ')
      .map(s => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '–'

  const daysUntil = (date?: string | null) => {
    if (!date) return null
    const d = new Date(date)
    if (isNaN(d.getTime())) return null
    const today = new Date()
    const diff = Math.ceil((d.getTime() - new Date(today.toDateString()).getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const filteredPOs = useMemo(() => {
    return pos.filter(po => {
      const term = searchTerm.toLowerCase()
      const vendorName =
        po.vendor?.name ||
        po.vendor?.company_name ||
        [po.vendor?.first_name, po.vendor?.last_name].filter(Boolean).join(' ')
      const matchesSearch =
        po.po_number?.toLowerCase().includes(term) ||
        (vendorName ? vendorName.toLowerCase().includes(term) : false)
      const matchesStatus = !statusFilter || normalizeStatus(po.status) === statusFilter
      const matchesCustomer = !customerFilter || po.customer?.id === customerFilter
      return matchesSearch && matchesStatus && matchesCustomer
    })
  }, [pos, searchTerm, statusFilter, customerFilter])

  const totalOrdered = pos.reduce((sum, po) => sum + (po.total_amount ?? 0), 0)
  const receivedAmount = pos
    .filter(po => {
      const st = normalizeStatus(po.status)
      return st === 'received' || st === 'partially_received'
    })
    .reduce((sum, po) => sum + (po.total_amount ?? 0), 0)
  const outstanding = totalOrdered - receivedAmount

  // --- render ---------------------------------------------------------------
  if (loading && pos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const renderStatusOptions = (current: POStatus) => {
    const allowed = ALL_STATUSES.filter(allowStatus)
    const showGhost = !allowStatus(current)
    return (
      <>
        {showGhost && (
          <option value={current} disabled>
            {statusLook[current].label} (not allowed)
          </option>
        )}
        {allowed.map(s => (
          <option key={s} value={s}>{statusLook[s].label}</option>
        ))}
      </>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
        <button
          type="button"
          onClick={() => { resetForm(); setEditingPO(null); setShowForm(true) }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:shadow-md hover:bg-blue-700 transition-all"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create PO
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center ring-1 ring-blue-100">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Ordered</p>
              <p className="text-2xl font-bold text-gray-900">{currency.format(totalOrdered)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center ring-1 ring-green-100">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Received</p>
              <p className="text-2xl font-bold text-gray-900">{currency.format(receivedAmount)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center ring-1 ring-amber-100">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">{currency.format(outstanding)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search POs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as POStatus | '')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            {ALL_STATUSES.filter(allowStatus).map(s => (
              <option key={s} value={s}>{statusLook[s].label}</option>
            ))}
          </select>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Customers</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.customer_type === 'residential' 
                  ? `${customer.first_name} ${customer.last_name}`
                  : customer.company_name
                }
              </option>
            ))}
          </select>
          <div className="flex items-center justify-end">
            <ViewToggle viewType={viewType} onViewChange={setViewType} />
          </div>
        </div>

        {/* quick filters */}
        <div className="mt-4 flex flex-wrap gap-2">
          {ALL_STATUSES.filter(allowStatus).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(prev => prev === s ? '' : s)}
              className={`text-xs px-2.5 py-1 rounded-full ${getChip(s)} ${statusFilter === s ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
            >
              {statusLook[s].label}
            </button>
          ))}
          {statusFilter && (
            <button className="text-xs px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200" type="button" onClick={() => setStatusFilter('')}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {viewType === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Work Order</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPOs.map((po, idx) => {
                  const st = normalizeStatus(po.status)
                  const due = daysUntil(po.expected_date)
                  const vendorName =
                    po.vendor?.name || po.vendor?.company_name ||
                    [po.vendor?.first_name, po.vendor?.last_name].filter(Boolean).join(' ')
                  return (
                    <tr
                      key={po.id}
                      onClick={() => setSelectedPO(po)}
                      className={`${getRowAccent(st)} ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} cursor-pointer`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{po.po_number}</div>
                        <div className="text-xs text-gray-500">{po.order_date ? new Date(po.order_date).toLocaleDateString() : '—'}</div>
                      </td>

                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gray-100 text-gray-700 text-xs flex items-center justify-center ring-1 ring-gray-200">
                            {initials(vendorName)}
                          </div>
                          <div>
                            <div className="text-sm text-gray-900">{vendorName || '—'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {po.customer ? (
                          po.customer.customer_type === 'residential' 
                            ? `${po.customer.first_name} ${po.customer.last_name}`
                            : po.customer.company_name
                        ) : 'No customer'}
                      </td>

                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {po.work_order ? (
                          <div>
                            <div className="font-medium">{po.work_order.wo_number}</div>
                            <div className="text-xs text-gray-500">{po.work_order.title}</div>
                          </div>
                        ) : 'No work order'}
                      </td>

                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {currency.format((po.total_amount ?? 0))}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${getDot(st)}`} />
                          <select
                            value={st}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const next = e.target.value as POStatus
                              const prev = st
                              setPOs(prevList => prevList.map(p => p.id === po.id ? { ...p, status: next } : p))
                              persistStatus(po.id, next, prev)
                            }}
                            className={`relative z-10 cursor-pointer text-xs font-semibold rounded-full px-2 py-1 border-0 ${getBadge(st)} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                          >
                            {renderStatusOptions(st)}
                          </select>
                        </div>
                      </td>

                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm">
                        {!po.expected_date ? (
                          <span className="text-gray-500">–</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-900">{new Date(po.expected_date).toLocaleDateString()}</span>
                            {due !== null && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                due < 0 ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' :
                                due === 0 ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' :
                                'bg-green-50 text-green-800 ring-1 ring-green-200'
                              }`}>
                                {due < 0 ? `${Math.abs(due)}d overdue` : due === 0 ? 'due today' : `in ${due}d`}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); setSelectedPO(po) }}
                            className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); startEdit(po) }}
                            className="text-blue-600 hover:text-blue-800 p-1.5 transition-all duration-200 hover:bg-blue-100 rounded-full hover:shadow-sm"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); deletePO(po.id) }}
                            className="text-rose-600 hover:text-rose-800 p-1.5 transition-all duration-200 hover:bg-rose-100 rounded-full hover:shadow-sm"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {filteredPOs.length === 0 && (
              <div className="py-16 text-center text-gray-500">
                <div className="mx-auto w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-gray-400" />
                </div>
                <p className="font-medium">No purchase orders found</p>
                <p className="text-sm">Try adjusting filters or create a new PO.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPOs.map((po) => {
                const st = normalizeStatus(po.status)
                const vendorName =
                  po.vendor?.name || po.vendor?.company_name ||
                  [po.vendor?.first_name, po.vendor?.last_name].filter(Boolean).join(' ')
                return (
                  <div key={po.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`h-2 w-2 rounded-full ${getDot(st)}`} />
                          <h3 className="text-lg font-semibold text-gray-900">{po.po_number}</h3>
                        </div>
                        <p className="text-2xl font-bold text-blue-600 mb-2">{currency.format((po.total_amount ?? 0))}</p>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getBadge(st)}`}>
                          {labelFor(st)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <div className="h-7 w-7 rounded-full bg-gray-100 text-gray-700 text-[10px] flex items-center justify-center ring-1 ring-gray-200 mr-2">
                          {initials(vendorName)}
                        </div>
                        <User className="w-4 h-4 mr-2" />
                        <span>{vendorName || '—'}</span>
                      </div>

                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span>Expected: {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '—'}</span>
                      </div>

                      {po.customer && (
                        <p className="text-sm text-gray-600 mb-2">
                          Customer: {po.customer.customer_type === 'residential' 
                            ? `${po.customer.first_name} ${po.customer.last_name}`
                            : po.customer.company_name
                          }
                        </p>
                      )}

                      {po.work_order && (
                        <p className="text-sm text-gray-600 mb-2">
                          Work Order: {po.work_order.wo_number} - {po.work_order.title}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-gray-200" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                      <div className="text-sm text-gray-500">
                        Ordered: {po.order_date ? new Date(po.order_date).toLocaleDateString() : '—'}
                      </div>
                      <div className="flex space-x-2">
                        <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={() => setSelectedPO(po)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          View
                        </button>
                        <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); startEdit(po) }} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPO ? 'Edit Purchase Order' : 'Create New Purchase Order'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {numberingError && !editingPO && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
                  {numberingError} — you can enter a PO number manually below.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PO Number</label>
                  <input
                    type="text"
                    value={formData.po_number}
                    onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${allowManualNumber ? '' : 'bg-gray-100 text-gray-700'}`}
                    readOnly={!allowManualNumber}
                    placeholder="PO-2025-0001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as POStatus })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {!allowStatus(formData.status) && (
                      <option value={formData.status} disabled>
                        {statusLook[formData.status].label} (not allowed)
                      </option>
                    )}
                    {ALL_STATUSES.filter(allowStatus).map(s => (
                      <option key={s} value={s}>{statusLook[s].label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vendor *</label>
                  <select
                    value={formData.vendor_id}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name || v.company_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Customer (Optional)</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.customer_type === 'residential' 
                          ? `${customer.first_name} ${customer.last_name}`
                          : customer.company_name
                        }
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select a customer to filter work orders
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Related Work Order</label>
                  <select
                    value={formData.work_order_id}
                    onChange={(e) => setFormData({ ...formData, work_order_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">None</option>
                    {filteredWorkOrders.map((wo) => (
                      <option key={wo.id} value={wo.id}>{wo.wo_number} - {wo.title}</option>
                    ))}
                  </select>
                  {formData.customer_id && filteredWorkOrders.length === 0 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      No work orders found for selected customer
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Order Date *</label>
                  <input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expected Date</label>
                  <input
                    type="date"
                    value={formData.expected_date}
                    onChange={(e) => setFormData({ ...formData, expected_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subtotal *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tax Rate (%)</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
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
                      <span className="text-sm text-gray-900">
                        {currency.format(parseFloat(formData.subtotal || '0'))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Tax ({formData.tax_rate}%):</span>
                      <span className="text-sm text-gray-900">
                        {currency.format(((parseFloat(formData.subtotal || '0') * parseFloat(formData.tax_rate || '0')) / 100) || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-lg font-bold text-gray-900">Total:</span>
                      <span className="text-lg font-bold text-blue-600">
                        {currency.format(
                          (parseFloat(formData.subtotal || '0') +
                           ((parseFloat(formData.subtotal || '0') * parseFloat(formData.tax_rate || '0')) / 100)) || 0
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onCancelForm}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : (editingPO ? 'Update PO' : 'Create PO')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal (hidden while form is open) */}
      {selectedPO && !showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  PO {selectedPO.po_number}
                </h3>
                <button type="button" onClick={() => setSelectedPO(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Order Information</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${getDot(selectedPO.status)}`} />
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getBadge(selectedPO.status)}`}>
                        {labelFor(selectedPO.status).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Order Date:</span>
                      <span className="text-sm text-gray-900">{selectedPO.order_date ? new Date(selectedPO.order_date).toLocaleDateString() : '—'}</span>
                    </div>
                    {selectedPO.expected_date && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Expected:</span>
                        <span className="text-sm text-gray-900">{new Date(selectedPO.expected_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {selectedPO.work_order && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Work Order:</span>
                        <span className="text-sm text-gray-900">{selectedPO.work_order.wo_number}</span>
                      </div>
                    )}
                    {selectedPO.customer && (
                      <p className="text-sm text-gray-600">
                        Customer: {selectedPO.customer.customer_type === 'residential' 
                          ? `${selectedPO.customer.first_name} ${selectedPO.customer.last_name}`
                          : selectedPO.customer.company_name
                        }
                      </p>
                    )}
                    {selectedPO.work_order && (
                      <p className="text-sm text-gray-600">
                        Work Order: {selectedPO.work_order.wo_number} - {selectedPO.work_order.title}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Vendor Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Vendor:</span>
                      <span className="text-sm text-gray-900">
                        {selectedPO.vendor?.name || selectedPO.vendor?.company_name ||
                          [selectedPO.vendor?.first_name, selectedPO.vendor?.last_name].filter(Boolean).join(' ')}
                      </span>
                    </div>
                    {selectedPO.vendor?.email && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Email:</span>
                        <span className="text-sm text-gray-900">{selectedPO.vendor.email}</span>
                      </div>
                    )}
                    {selectedPO.vendor?.phone && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Phone:</span>
                        <span className="text-sm text-gray-900">{selectedPO.vendor.phone}</span>
                      </div>
                    )}
                    {selectedPO.vendor?.address && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Address:</span>
                        <span className="text-sm text-gray-900">{selectedPO.vendor.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); startEdit(selectedPO) }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit PO
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPO(null)}
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