/*
  # Update subscription plans features

  1. Changes
    - Remove CRM features from Pro plan
    - Update feature lists for all plans
    - Ensure proper feature restrictions

  2. Features by Plan
    - Starter: Basic work orders, customers, invoicing
    - Pro: Adds projects, inventory, advanced reports
    - Business: Adds CRM, multi-location, API access
*/

-- Update Starter plan features
UPDATE subscription_plans 
SET features = '{
  "work_orders": true,
  "customers": true,
  "invoicing": true,
  "time_tracking": true,
  "basic_reports": true,
  "mobile_app": true
}'::jsonb
WHERE name = 'Starter';

-- Update Pro plan features (removed CRM)
UPDATE subscription_plans 
SET features = '{
  "work_orders": true,
  "customers": true,
  "invoicing": true,
  "time_tracking": true,
  "basic_reports": true,
  "mobile_app": true,
  "projects": true,
  "inventory": true,
  "estimates": true,
  "purchase_orders": true,
  "advanced_reports": true,
  "maintenance": true
}'::jsonb
WHERE name = 'Pro';

-- Update Business plan features (CRM included)
UPDATE subscription_plans 
SET features = '{
  "work_orders": true,
  "customers": true,
  "invoicing": true,
  "time_tracking": true,
  "basic_reports": true,
  "mobile_app": true,
  "projects": true,
  "inventory": true,
  "estimates": true,
  "purchase_orders": true,
  "advanced_reports": true,
  "maintenance": true,
  "crm": true,
  "leads": true,
  "opportunities": true,
  "multi_location": true,
  "api_access": true,
  "custom_fields": true,
  "advanced_integrations": true
}'::jsonb
WHERE name = 'Business';