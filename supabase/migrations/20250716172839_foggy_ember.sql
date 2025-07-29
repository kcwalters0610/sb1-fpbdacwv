/*
  # Create function to get companies with registration code

  1. New Functions
    - Creates a function that returns companies with their registration code extracted from the settings JSONB
*/

-- Create a function to get companies with their registration code
CREATE OR REPLACE FUNCTION get_companies_with_registration_code()
RETURNS TABLE (
  id uuid,
  name text,
  registration_code text
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.settings->>'registration_code' as registration_code
  FROM 
    companies c;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_companies_with_registration_code() TO authenticated;
GRANT EXECUTE ON FUNCTION get_companies_with_registration_code() TO anon;