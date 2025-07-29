/*
  # Add registration code to companies

  1. Updates
    - Add a default registration code to all companies that don't have one
    - This allows existing companies to have a registration code for new user signups
  
  2. Security
    - No changes to security policies
*/

-- Update all companies to have a registration code if they don't already have one
UPDATE companies
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{registration_code}',
  to_jsonb(
    CASE 
      WHEN settings->>'registration_code' IS NULL 
      THEN UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 8))
      ELSE settings->>'registration_code'
    END
  )
)
WHERE settings->>'registration_code' IS NULL;