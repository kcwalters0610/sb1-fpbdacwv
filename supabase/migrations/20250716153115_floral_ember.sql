/*
  # Add technician locations table and function

  1. New Tables
    - `technician_locations`
      - `id` (uuid, primary key)
      - `technician_id` (uuid, references profiles)
      - `company_id` (uuid, references companies)
      - `latitude` (double precision)
      - `longitude` (double precision)
      - `accuracy` (double precision)
      - `timestamp` (timestamptz)
      - `created_at` (timestamptz)
  
  2. New Functions
    - `get_latest_technician_locations` - Returns the most recent location for each technician in a company
  
  3. Security
    - Enable RLS on `technician_locations` table
    - Add policies for technicians to insert their own locations
    - Add policies for company users to view locations
*/

-- Create technician_locations table
CREATE TABLE IF NOT EXISTS technician_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS technician_locations_technician_id_idx ON technician_locations(technician_id);
CREATE INDEX IF NOT EXISTS technician_locations_company_id_idx ON technician_locations(company_id);
CREATE INDEX IF NOT EXISTS technician_locations_timestamp_idx ON technician_locations(timestamp);

-- Enable RLS
ALTER TABLE technician_locations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Technicians can insert their own locations"
  ON technician_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    technician_id = auth.uid() AND
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view locations in their company"
  ON technician_locations
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Create function to get latest location for each technician
CREATE OR REPLACE FUNCTION get_latest_technician_locations(company_id_param uuid)
RETURNS TABLE (
  technician_id uuid,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  timestamp timestamptz
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_locations AS (
    SELECT DISTINCT ON (technician_id)
      technician_id,
      latitude,
      longitude,
      accuracy,
      timestamp
    FROM technician_locations
    WHERE company_id = company_id_param
    ORDER BY technician_id, timestamp DESC
  )
  SELECT * FROM latest_locations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;