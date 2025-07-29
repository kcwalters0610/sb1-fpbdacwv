/*
  # Add office role to profiles table

  1. Changes
    - Update the profiles_role_check constraint to include 'office' role
    - This allows creating users with the office role

  2. Security
    - No changes to RLS policies needed as they already work with any role
*/

-- Drop the existing check constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add the new check constraint that includes 'office'
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, 'tech'::text, 'office'::text]));