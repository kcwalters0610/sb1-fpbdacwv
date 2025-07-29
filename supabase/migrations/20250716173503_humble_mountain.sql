/*
  # Ensure all companies have registration codes

  1. Updates
    - Ensures all companies have a registration code in their settings
    - Creates a function to easily retrieve companies with their registration codes
*/

-- Function to generate a random registration code
CREATE OR REPLACE FUNCTION generate_registration_code() RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed similar looking characters
  result text := '';
  i integer := 0;
  pos integer;
BEGIN
  FOR i IN 1..6 LOOP
    pos := 1 + floor(random() * length(chars));
    result := result || substr(chars, pos, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update all companies to ensure they have a registration code
DO $$
DECLARE
  company_record RECORD;
  new_code text;
  current_settings jsonb;
BEGIN
  FOR company_record IN SELECT id, settings FROM companies LOOP
    current_settings := COALESCE(company_record.settings, '{}'::jsonb);
    
    -- Only add a registration code if one doesn't exist
    IF current_settings->>'registration_code' IS NULL THEN
      new_code := generate_registration_code();
      current_settings := jsonb_set(current_settings, '{registration_code}', to_jsonb(new_code));
      
      UPDATE companies 
      SET settings = current_settings
      WHERE id = company_record.id;
    END IF;
  END LOOP;
END $$;

-- Create a function to get companies with their registration codes
CREATE OR REPLACE FUNCTION get_companies_with_registration_code()
RETURNS TABLE (
  id uuid,
  name text,
  registration_code text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.settings->>'registration_code' as registration_code
  FROM 
    companies c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;