/*
  # Add purchase order items table

  1. New Tables
    - `purchase_order_items`
      - `id` (uuid, primary key)
      - `purchase_order_id` (uuid, foreign key to purchase_orders)
      - `company_id` (uuid, foreign key to companies)
      - `description` (text)
      - `quantity` (numeric)
      - `unit_price` (numeric)
      - `amount` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  2. Security
    - Enable RLS on `purchase_order_items` table
    - Add policies for authenticated users to manage purchase order items in their company
*/

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_order_items_purchase_order_id_idx ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS purchase_order_items_company_id_idx ON purchase_order_items(company_id);

-- Enable Row Level Security
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Policies for purchase order items
CREATE POLICY "Users can view purchase order items in their company"
  ON purchase_order_items
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins and managers can manage purchase order items"
  ON purchase_order_items
  FOR ALL
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));