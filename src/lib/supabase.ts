import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file:\n' +
    `VITE_SUPABASE_URL: ${supabaseUrl ? 'Set' : 'Missing'}\n` +
    `VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'Set' : 'Missing'}`
  )
}

// Validate URL format
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  throw new Error(
    `Invalid Supabase URL format: ${supabaseUrl}\n` +
    'Expected format: https://your-project-ref.supabase.co'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
})

// Database types based on actual schema
export type Customer = {
  id: string
  company_id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  customer_type: 'residential' | 'commercial'
  company_name?: string
  created_at: string
  updated_at: string
  sites?: CustomerSite[]
}

export type CustomerSite = {
  id: string
  customer_id: string
  company_id: string
  site_name: string
  contact_first_name?: string
  contact_last_name?: string
  contact_email?: string
  contact_phone?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  is_primary: boolean
  is_active: boolean
  notes?: string
  created_at: string
  updated_at: string
}

export type Profile = {
  id: string
  company_id: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'manager' | 'tech' | 'office'
  phone?: string
  is_active?: boolean
  created_at: string
  updated_at: string
}

export type WorkOrder = {
  id: string
  company_id: string
  customer_id: string
  assigned_to?: string
  department_id?: string
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_date?: string
  completed_date?: string
  actual_hours?: number
  resolution_notes?: string
  wo_number: string
  customer_site_id?: string
  created_at: string
  updated_at: string
  customer?: Customer
  assigned_technician?: Profile
  assigned_dept?: any
  assignments?: any[]
  customer_site?: CustomerSite
}

export type InventoryItem = {
  id: string
  company_id: string
  name: string
  sku: string
  quantity: number
  unit_price: number
  reorder_level: number
  description?: string
  category?: string
  supplier?: string
  location?: string
  created_at: string
  updated_at: string
}

export type Estimate = {
  id: string
  company_id: string
  customer_id: string
  estimate_number: string
  title: string
  description?: string
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted'
  issue_date: string
  expiry_date?: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  notes?: string
  settings?: any
  created_at: string
  updated_at: string
  customer_site_id?: string
  customer?: Customer
  customer_site?: CustomerSite
}

export type Project = {
  id: string
  project_number: string
  project_name: string
  description?: string
  company_id: string
  customer_id: string
  project_manager?: string
  start_date?: string
  estimated_end_date?: string
  actual_end_date?: string
  total_budget: number
  actual_cost: number
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  created_at: string
  updated_at: string
  notes?: string
  estimate_id?: string
  customer_site_id?: string
  customer?: Customer
  project_manager_profile?: Profile
  source_estimate?: Estimate
  customer_site?: CustomerSite
}

export type Equipment = {
  id: string
  company_id: string
  name: string
  model_number?: string
  serial_number?: string
  unit_number?: string
  manufacturer?: string
  installation_date?: string
  location?: string
  status: 'active' | 'inactive' | 'maintenance' | 'decommissioned'
  notes?: string
  customer_id?: string
  created_at: string
  updated_at: string
  customer?: Customer
}

export type MaintenanceTask = {
  id: string
  company_id: string
  name: string
  description?: string
  estimated_duration_minutes: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MaintenanceSchedule = {
  id: string
  company_id: string
  equipment_id: string
  task_id: string
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'biannual' | 'annual'
  last_performed_date?: string
  next_due_date?: string
  created_at: string
  updated_at: string
  equipment?: Equipment
  task?: MaintenanceTask
}

export type MaintenanceLog = {
  id: string
  company_id: string
  equipment_id: string
  task_id: string
  schedule_id?: string
  performed_by: string
  performed_date: string
  notes?: string
  status: 'completed' | 'incomplete' | 'needs_followup'
  created_at: string
  updated_at: string
  equipment?: Equipment
  task?: MaintenanceTask
  technician?: Profile
}

export type TechnicianLocation = {
  technician_id: string
  latitude: number
  longitude: number
  accuracy: number
  timestamp: string
}

export type DepartmentMember = {
  id: string
  department_id: string
  user_id: string
  created_at: string
}