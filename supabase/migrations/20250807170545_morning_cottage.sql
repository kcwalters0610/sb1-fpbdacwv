/*
  # Update Subscription Plans

  1. Changes
    - Update companies table to use new subscription plan values
    - Add plan validation constraint
    - Set default plan to 'starter'

  2. Plan Tiers
    - starter: Work Orders, Vendors, Purchase Orders, Inventory, Maintenance
    - pro: Starter + Estimates, Dispatch, Projects  
    - business: Pro + CRM, Reports

  3. Security
    - No changes to existing RLS policies
*/

-- Update the subscription_plan column to use the new plan names
ALTER TABLE companies 
DROP CONSTRAINT IF EXISTS companies_subscription_plan_check;

ALTER TABLE companies 
ADD CONSTRAINT companies_subscription_plan_check 
CHECK (subscription_plan = ANY (ARRAY['starter'::text, 'pro'::text, 'business'::text]));

-- Update default value
ALTER TABLE companies 
ALTER COLUMN subscription_plan SET DEFAULT 'starter'::text;

-- Update any existing 'basic' plans to 'starter'
UPDATE companies 
SET subscription_plan = 'starter' 
WHERE subscription_plan = 'basic' OR subscription_plan IS NULL;