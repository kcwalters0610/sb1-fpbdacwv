/*
  # Add registration code to companies

  1. Updates
    - Add registration code to all companies in the settings JSONB field
  
  2. Purpose
    - Enables user registration with company code
    - Prevents unauthorized signups
*/

-- Function to generate a random registration code
CREATE OR REPLACE FUNCTION generate_registration_code() RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER := 0;
  rand_index INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    rand_index := floor(random() * length(chars) + 1);
    result := result || substr(chars, rand_index, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update all companies to have a registration code in their settings
DO $$
DECLARE
  company_record RECORD;
  new_settings JSONB;
  reg_code TEXT;
BEGIN
  FOR company_record IN SELECT id, settings FROM companies LOOP
    -- Generate a unique registration code
    reg_code := generate_registration_code();
    
    -- Update settings to include registration code
    IF company_record.settings IS NULL THEN
      new_settings := jsonb_build_object('registration_code', reg_code);
    ELSE
      new_settings := company_record.settings || jsonb_build_object('registration_code', reg_code);
    END IF;
    
    -- Update the company record
    UPDATE companies 
    SET settings = new_settings
    WHERE id = company_record.id;
  END LOOP;
END;
$$;

-- Drop the function as it's no longer needed
DROP FUNCTION generate_registration_code();