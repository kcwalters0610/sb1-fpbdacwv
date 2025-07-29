/*
  # Add inventory items table

  1. New Tables
    - `inventory_items`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `name` (text, required)
      - `sku` (text, required, unique)
      - `quantity` (integer, default 0)
      - `unit_price` (numeric, default 0.00)
      - `reorder_level` (integer, default 0)
      - `description` (text, optional)
      - `category` (text, optional)
      - `supplier` (text, optional)
      - `location` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `inventory_items` table
    - Add policies for company-based access
*/

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0.00,
  reorder_level integer NOT NULL DEFAULT 0,
  description text,
  category text,
  supplier text,
  location text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS inventory_items_company_id_idx ON inventory_items(company_id);
CREATE INDEX IF NOT EXISTS inventory_items_sku_idx ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS inventory_items_quantity_idx ON inventory_items(quantity);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_company_sku_unique ON inventory_items(company_id, sku);

-- Enable Row Level Security
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Create policies for inventory items
CREATE POLICY "Users can view inventory items in their company"
  ON inventory_items
  FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can manage inventory items in their company"
  ON inventory_items
  FOR ALL
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- Insert some sample inventory items for testing
INSERT INTO inventory_items (company_id, name, sku, quantity, unit_price, reorder_level, description, category) 
SELECT 
  c.id,
  'HVAC Filter 16x20',
  'HVF-1620',
  25,
  12.99,
  10,
  'Standard 16x20 HVAC air filter',
  'HVAC'
FROM companies c
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO inventory_items (company_id, name, sku, quantity, unit_price, reorder_level, description, category)
SELECT 
  c.id,
  'Electrical Wire 12AWG',
  'EW-12AWG',
  500,
  0.89,
  100,
  '12 AWG electrical wire per foot',
  'Electrical'
FROM companies c
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO inventory_items (company_id, name, sku, quantity, unit_price, reorder_level, description, category)
SELECT 
  c.id,
  'PVC Pipe 2"',
  'PVC-2IN',
  15,
  8.50,
  5,
  '2 inch PVC pipe',
  'Plumbing'
FROM companies c
LIMIT 1
ON CONFLICT DO NOTHING;