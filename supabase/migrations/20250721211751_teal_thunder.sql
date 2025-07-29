/*
  # Add customer_site_id column to projects table

  1. Schema Changes
    - Add `customer_site_id` column to `projects` table
    - Set up foreign key relationship to `customer_sites` table
    - Add index for performance

  2. Security
    - No RLS changes needed (inherits from existing project policies)

  This allows projects to be associated with specific customer sites for better location tracking.
*/

-- Add customer_site_id column to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'customer_site_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN customer_site_id uuid;
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'projects_customer_site_id_fkey'
  ) THEN
    ALTER TABLE projects 
    ADD CONSTRAINT projects_customer_site_id_fkey 
    FOREIGN KEY (customer_site_id) REFERENCES customer_sites(id);
  END IF;
END $$;

-- Add index for performance if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'projects_customer_site_id_idx'
  ) THEN
    CREATE INDEX projects_customer_site_id_idx ON projects(customer_site_id);
  END IF;
END $$;