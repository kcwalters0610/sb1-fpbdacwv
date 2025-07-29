/*
  # Add customer_site_id to estimates table

  1. Schema Changes
    - Add customer_site_id column to estimates table
    - Add foreign key constraint to customer_sites table
    - Add index for performance

  2. Security
    - No RLS changes needed (inherits from existing policies)
*/

-- Add customer_site_id column to estimates table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'customer_site_id'
  ) THEN
    ALTER TABLE estimates ADD COLUMN customer_site_id uuid;
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'estimates_customer_site_id_fkey'
  ) THEN
    ALTER TABLE estimates 
    ADD CONSTRAINT estimates_customer_site_id_fkey 
    FOREIGN KEY (customer_site_id) REFERENCES customer_sites(id);
  END IF;
END $$;

-- Add index for performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'estimates_customer_site_id_idx'
  ) THEN
    CREATE INDEX estimates_customer_site_id_idx ON estimates(customer_site_id);
  END IF;
END $$;