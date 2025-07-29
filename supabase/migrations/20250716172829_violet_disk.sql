/*
  # Add registration code to companies

  1. Changes
    - Updates all existing companies to have a registration code in their settings
    - Generates a random 8-character alphanumeric code for each company
*/

-- Function to generate a random alphanumeric string of specified length
CREATE OR REPLACE FUNCTION generate_random_code(length integer) RETURNS text AS $$
DECLARE
  chars text[] := '{0,1,2,3,4,5,6,7,8,9,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z}';
  result text := '';
  i integer := 0;
BEGIN
  FOR i IN 1..length LOOP
    result := result || chars[1+random()*(array_length(chars, 1)-1)];
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update all companies to have a registration code in their settings
UPDATE companies
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{registration_code}',
  to_jsonb(generate_random_code(8))
)
WHERE settings->>'registration_code' IS NULL;

-- Drop the function after use
DROP FUNCTION generate_random_code(integer);