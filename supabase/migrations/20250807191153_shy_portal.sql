/*
  # Remove Reports from Pro Plan

  1. Updates
    - Remove `advanced_reports` feature from Pro plan
    - Keep `basic_reports` in Starter plan
    - Move `advanced_reports` to Business plan only

  2. Changes
    - Pro plan will only have basic reporting capabilities
    - Advanced reports (detailed analytics, exports, etc.) restricted to Business plan
*/

UPDATE subscription_plans 
SET features = jsonb_set(
  features,
  '{advanced_reports}',
  'false'
)
WHERE name = 'Pro';

-- Ensure Business plan has advanced reports
UPDATE subscription_plans 
SET features = jsonb_set(
  features,
  '{advanced_reports}',
  'true'
)
WHERE name = 'Business';