/*
  # Add Labor Rates Table

  1. New Tables
    - `labor_rates`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `department_id` (uuid, foreign key to departments)
      - `role` (text, employee role)
      - `hourly_rate` (numeric, rate per hour)
      - `overtime_rate` (numeric, overtime rate per hour)
      - `effective_date` (date, when rate becomes effective)
      - `is_active` (boolean, whether rate is currently active)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `labor_rates` table
    - Add policies for company-based access control

  3. Indexes
    - Index on company_id for performance
    - Index on department_id for lookups
    - Index on effective_date for rate history
*/

CREATE TABLE IF NOT EXISTS labor_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'tech', 'office')),
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (hourly_rate >= 0),
  overtime_rate numeric(10,2) DEFAULT 0.00 CHECK (overtime_rate >= 0),
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE labor_rates ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS labor_rates_company_id_idx ON labor_rates(company_id);
CREATE INDEX IF NOT EXISTS labor_rates_department_id_idx ON labor_rates(department_id);
CREATE INDEX IF NOT EXISTS labor_rates_effective_date_idx ON labor_rates(effective_date);
CREATE INDEX IF NOT EXISTS labor_rates_role_idx ON labor_rates(role);

-- RLS Policies
CREATE POLICY "Admins can manage labor rates"
  ON labor_rates
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Managers can view labor rates in their company"
  ON labor_rates
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can view their own labor rates"
  ON labor_rates
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid()
    )
  );