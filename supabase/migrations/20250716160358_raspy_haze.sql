/*
  # Add Equipment and Maintenance Tracking

  1. New Tables
    - `equipment` - Stores equipment information including serial numbers, model numbers, and unit numbers
    - `maintenance_tasks` - Defines maintenance tasks that need to be performed
    - `maintenance_schedules` - Links equipment to maintenance tasks with frequency
    - `maintenance_logs` - Records completed maintenance activities

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage equipment and maintenance within their company
*/

-- Equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  model_number text,
  serial_number text,
  unit_number text,
  manufacturer text,
  installation_date date,
  location text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
  notes text,
  customer_id uuid REFERENCES customers(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_company_id_idx ON equipment(company_id);
CREATE INDEX IF NOT EXISTS equipment_customer_id_idx ON equipment(customer_id);
CREATE INDEX IF NOT EXISTS equipment_status_idx ON equipment(status);

-- Maintenance tasks table
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  estimated_duration_minutes integer DEFAULT 60,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_tasks_company_id_idx ON maintenance_tasks(company_id);

-- Maintenance schedules table
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'biannual', 'annual')),
  last_performed_date date,
  next_due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_schedules_company_id_idx ON maintenance_schedules(company_id);
CREATE INDEX IF NOT EXISTS maintenance_schedules_equipment_id_idx ON maintenance_schedules(equipment_id);
CREATE INDEX IF NOT EXISTS maintenance_schedules_task_id_idx ON maintenance_schedules(task_id);
CREATE INDEX IF NOT EXISTS maintenance_schedules_next_due_date_idx ON maintenance_schedules(next_due_date);

-- Maintenance logs table
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES maintenance_schedules(id),
  performed_by uuid NOT NULL REFERENCES profiles(id),
  performed_date date NOT NULL,
  notes text,
  status text NOT NULL CHECK (status IN ('completed', 'incomplete', 'needs_followup')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_logs_company_id_idx ON maintenance_logs(company_id);
CREATE INDEX IF NOT EXISTS maintenance_logs_equipment_id_idx ON maintenance_logs(equipment_id);
CREATE INDEX IF NOT EXISTS maintenance_logs_task_id_idx ON maintenance_logs(task_id);
CREATE INDEX IF NOT EXISTS maintenance_logs_performed_by_idx ON maintenance_logs(performed_by);
CREATE INDEX IF NOT EXISTS maintenance_logs_performed_date_idx ON maintenance_logs(performed_date);

-- Enable Row Level Security
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for equipment
CREATE POLICY "Users can view equipment in their company"
  ON equipment
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage equipment in their company"
  ON equipment
  FOR ALL
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- RLS Policies for maintenance_tasks
CREATE POLICY "Users can view maintenance tasks in their company"
  ON maintenance_tasks
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage maintenance tasks in their company"
  ON maintenance_tasks
  FOR ALL
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- RLS Policies for maintenance_schedules
CREATE POLICY "Users can view maintenance schedules in their company"
  ON maintenance_schedules
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage maintenance schedules in their company"
  ON maintenance_schedules
  FOR ALL
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- RLS Policies for maintenance_logs
CREATE POLICY "Users can view maintenance logs in their company"
  ON maintenance_logs
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage maintenance logs in their company"
  ON maintenance_logs
  FOR ALL
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));