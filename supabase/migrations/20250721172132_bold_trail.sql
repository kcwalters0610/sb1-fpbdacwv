/*
  # Add Customer Sites Support

  1. New Tables
    - `customer_sites`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, foreign key to customers)
      - `company_id` (uuid, foreign key to companies)
      - `site_name` (text)
      - `contact_first_name` (text)
      - `contact_last_name` (text)
      - `contact_email` (text)
      - `contact_phone` (text)
      - `address` (text)
      - `city` (text)
      - `state` (text)
      - `zip_code` (text)
      - `is_primary` (boolean)
      - `is_active` (boolean)
      - `notes` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `customer_sites` table
    - Add policies for company-based access

  3. Changes
    - Add indexes for performance
    - Add constraints to ensure data integrity
*/

-- Create customer_sites table
CREATE TABLE IF NOT EXISTS customer_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_name text NOT NULL,
  contact_first_name text,
  contact_last_name text,
  contact_email text,
  contact_phone text,
  address text,
  city text,
  state text,
  zip_code text,
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS customer_sites_customer_id_idx ON customer_sites(customer_id);
CREATE INDEX IF NOT EXISTS customer_sites_company_id_idx ON customer_sites(company_id);
CREATE INDEX IF NOT EXISTS customer_sites_is_primary_idx ON customer_sites(is_primary);

-- Enable RLS
ALTER TABLE customer_sites ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can manage customer sites in their company"
  ON customer_sites
  FOR ALL
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- Add constraint to ensure only one primary site per customer
CREATE UNIQUE INDEX IF NOT EXISTS customer_sites_primary_unique 
  ON customer_sites(customer_id) 
  WHERE is_primary = true;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_sites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_customer_sites_updated_at
  BEFORE UPDATE ON customer_sites
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_sites_updated_at();