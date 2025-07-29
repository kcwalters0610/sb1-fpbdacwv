/*
  # Add customer site support to work orders

  1. Changes
    - Add `customer_site_id` column to work_orders table
    - Add foreign key constraint to customer_sites table
    - Add index for better query performance

  2. Security
    - No RLS changes needed as work_orders already has proper policies
*/

-- Add customer_site_id column to work_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'customer_site_id'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN customer_site_id uuid;
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'work_orders_customer_site_id_fkey'
  ) THEN
    ALTER TABLE work_orders 
    ADD CONSTRAINT work_orders_customer_site_id_fkey 
    FOREIGN KEY (customer_site_id) REFERENCES customer_sites(id);
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS work_orders_customer_site_id_idx 
ON work_orders(customer_site_id);