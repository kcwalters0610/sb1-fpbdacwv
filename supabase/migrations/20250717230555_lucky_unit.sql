/*
  # Create technician_locations table for GPS tracking

  1. New Tables
    - `technician_locations`
      - `id` (uuid, primary key)
      - `technician_id` (uuid, foreign key to profiles)
      - `company_id` (uuid, foreign key to companies)
      - `latitude` (real)
      - `longitude` (real)
      - `accuracy` (real)
      - `timestamp` (timestamptz)

  2. Security
    - Enable RLS on `technician_locations` table
    - Add policies for technicians to insert their own locations
    - Add policies for company members to read locations
*/

CREATE TABLE IF NOT EXISTS technician_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  latitude real NOT NULL,
  longitude real NOT NULL,
  accuracy real NOT NULL,
  timestamp timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS technician_locations_technician_id_idx ON technician_locations(technician_id);
CREATE INDEX IF NOT EXISTS technician_locations_company_id_idx ON technician_locations(company_id);
CREATE INDEX IF NOT EXISTS technician_locations_timestamp_idx ON technician_locations(timestamp);

-- Enable RLS
ALTER TABLE technician_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for own company technicians"
  ON technician_locations
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT profiles.id 
      FROM profiles 
      WHERE profiles.company_id = technician_locations.company_id
    )
  );

CREATE POLICY "Enable insert for own technician_id"
  ON technician_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = technician_id);

CREATE POLICY "Enable update for own technician_id"
  ON technician_locations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = technician_id)
  WITH CHECK (auth.uid() = technician_id);

CREATE POLICY "Enable delete for own technician_id"
  ON technician_locations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = technician_id);