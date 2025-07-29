/*
  # Add registration code to company settings

  1. New Features
    - Adds a registration code field to company settings
    - This code will be required for new user registration
    - Only users with the correct code can register for a specific company

  2. Security
    - Enhances security by preventing unauthorized registrations
    - Only company administrators can set and change the registration code
*/

-- Add a default registration code to all existing companies
UPDATE companies
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{registration_code}',
  to_jsonb(CONCAT(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 8)))
)
WHERE settings->>'registration_code' IS NULL;