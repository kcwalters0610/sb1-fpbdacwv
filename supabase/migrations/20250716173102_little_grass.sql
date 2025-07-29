/*
  # Ensure registration codes for all companies
  
  1. Updates
    - Adds a registration code to all companies that don't have one
    - Creates a function to get companies with their registration codes
  
  2. Security
    - No changes to security
*/

-- Update all companies to ensure they have a registration code
UPDATE companies
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{registration_code}',
  to_jsonb(
    CASE 
      WHEN settings->>'registration_code' IS NULL 
      THEN SUBSTRING(UPPER(encode(gen_random_bytes(4), 'hex')), 1, 8)
      ELSE settings->>'registration_code'
    END
  )
)
WHERE settings->>'registration_code' IS NULL OR settings IS NULL;

-- Create a function to get companies with their registration codes
CREATE OR REPLACE FUNCTION get_companies_with_registration_code()
RETURNS TABLE (
  id uuid,
  name text,
  registration_code text
) 
LANGUAGE plpgsql
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
$$;