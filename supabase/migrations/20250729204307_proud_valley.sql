/*
  # Create truck_inventory table

  1. New Tables
    - `truck_inventory`
      - `id` (uuid, primary key)
      - `work_order_id` (uuid, foreign key to work_orders)
      - `company_id` (uuid, foreign key to companies)
      - `inventory_item_id` (uuid, foreign key to inventory_items)
      - `quantity_used` (numeric, quantity of items used)
      - `notes` (text, optional notes about usage)
      - `used_by` (uuid, foreign key to profiles - who used the items)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `truck_inventory` table
    - Add policies for company-based access control
    - Users can insert/view truck inventory for their company
    - Admins and managers can manage all truck inventory in their company

  3. Indexes
    - Index on work_order_id for fast lookups
    - Index on company_id for RLS performance
    - Index on inventory_item_id for joins
*/

CREATE TABLE IF NOT EXISTS truck_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_used numeric NOT NULL DEFAULT 0,
  notes text,
  used_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS truck_inventory_work_order_id_idx ON truck_inventory(work_order_id);
CREATE INDEX IF NOT EXISTS truck_inventory_company_id_idx ON truck_inventory(company_id);
CREATE INDEX IF NOT EXISTS truck_inventory_inventory_item_id_idx ON truck_inventory(inventory_item_id);
CREATE INDEX IF NOT EXISTS truck_inventory_used_by_idx ON truck_inventory(used_by);

-- Enable Row Level Security
ALTER TABLE truck_inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view truck inventory in their company"
  ON truck_inventory
  FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert truck inventory for their company"
  ON truck_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    ) AND
    used_by = auth.uid()
  );

CREATE POLICY "Admins and managers can manage truck inventory"
  ON truck_inventory
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can update their own truck inventory entries"
  ON truck_inventory
  FOR UPDATE
  TO authenticated
  USING (used_by = auth.uid())
  WITH CHECK (used_by = auth.uid());

CREATE POLICY "Users can delete their own truck inventory entries"
  ON truck_inventory
  FOR DELETE
  TO authenticated
  USING (used_by = auth.uid());