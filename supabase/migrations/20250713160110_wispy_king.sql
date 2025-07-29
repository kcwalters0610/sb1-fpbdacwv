/*
  # Fix RLS policies for departments table

  1. Security Updates
    - Drop existing restrictive policies
    - Create proper INSERT policy that includes company_id
    - Create proper UPDATE policy with company_id check
    - Ensure admins can manage departments in their company

  2. Changes
    - Fix INSERT policy to automatically set company_id from user's profile
    - Fix UPDATE policy to check company_id matches user's company
    - Add proper WITH CHECK clauses for data integrity
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage departments" ON departments;
DROP POLICY IF EXISTS "Users can view departments in their company" ON departments;

-- Create proper policies for departments
CREATE POLICY "Users can view departments in their company" ON departments
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can insert departments" ON departments
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update departments" ON departments
  FOR UPDATE TO authenticated
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

CREATE POLICY "Admins can delete departments" ON departments
  FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );