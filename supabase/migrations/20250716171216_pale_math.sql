/*
  # Add company_id to department_members table

  1. Changes
    - Add company_id column to department_members table
    - Add foreign key constraint to companies table
    - Add index on company_id for better query performance
    - Update RLS policies to include company_id checks
    - Add trigger to automatically set company_id from department
  
  2. Security
    - Ensure RLS policies check company_id for proper data isolation
*/

-- Add company_id column
ALTER TABLE department_members ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS department_members_company_id_idx ON department_members(company_id);

-- Create function to set company_id from department
CREATE OR REPLACE FUNCTION set_department_member_company_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Get company_id from the department
  SELECT company_id INTO NEW.company_id
  FROM departments
  WHERE id = NEW.department_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set company_id
CREATE TRIGGER trigger_set_department_member_company_id
BEFORE INSERT ON department_members
FOR EACH ROW
EXECUTE FUNCTION set_department_member_company_id();

-- Update existing records to set company_id
UPDATE department_members dm
SET company_id = d.company_id
FROM departments d
WHERE dm.department_id = d.id
AND dm.company_id IS NULL;

-- Update RLS policies to include company_id checks
DROP POLICY IF EXISTS "Admins can manage department members" ON department_members;
CREATE POLICY "Admins can manage department members"
ON department_members
TO authenticated
USING (
  (department_id IN (
    SELECT d.id
    FROM departments d
    JOIN profiles p ON p.company_id = d.company_id
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ))
  AND
  (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Department managers can manage their members" ON department_members;
CREATE POLICY "Department managers can manage their members"
ON department_members
TO authenticated
USING (
  (department_id IN (
    SELECT d.id
    FROM departments d
    WHERE d.manager_id = auth.uid()
  ))
  AND
  (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Users can view department members in their company" ON department_members;
CREATE POLICY "Users can view department members in their company"
ON department_members
TO authenticated
USING (
  (department_id IN (
    SELECT d.id
    FROM departments d
    JOIN profiles p ON p.company_id = d.company_id
    WHERE p.id = auth.uid()
  ))
  AND
  (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ))
);