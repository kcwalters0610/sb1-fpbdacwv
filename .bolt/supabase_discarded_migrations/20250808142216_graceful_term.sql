/*
  # Add Free Subscription Plan

  1. New Plan
    - `Free` plan with $0 monthly price
    - 1 user included (can be overridden)
    - All features enabled for testing/special cases
    - Hidden from public plan selection (is_active = false)
    
  2. Security
    - Plan is not visible in regular subscription UI
    - Only backend/admin access for assignment
*/

-- Insert the Free plan
INSERT INTO subscription_plans (
  id,
  name,
  description,
  monthly_price,
  user_limit,
  overage_price,
  features,
  is_active
) VALUES (
  gen_random_uuid(),
  'Free',
  'Special free access plan - Admin use only',
  0.00,
  1,
  0.00,
  '{
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
  }'::jsonb,
  false
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  monthly_price = EXCLUDED.monthly_price,
  user_limit = EXCLUDED.user_limit,
  overage_price = EXCLUDED.overage_price,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;

-- Create a function to assign free plan (admin use only)
CREATE OR REPLACE FUNCTION assign_free_plan(
  target_company_id uuid,
  user_limit_override integer DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  free_plan_id uuid;
  result json;
BEGIN
  -- Check if the calling user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can assign free plans';
  END IF;

  -- Get the free plan ID
  SELECT id INTO free_plan_id
  FROM subscription_plans
  WHERE name = 'Free'
  LIMIT 1;

  IF free_plan_id IS NULL THEN
    RAISE EXCEPTION 'Free plan not found';
  END IF;

  -- Cancel existing subscription
  UPDATE company_subscriptions
  SET status = 'cancelled',
      cancelled_at = now()
  WHERE company_id = target_company_id
    AND status = 'active';

  -- Create new free subscription
  INSERT INTO company_subscriptions (
    company_id,
    plan_id,
    status,
    current_period_start,
    current_period_end
  ) VALUES (
    target_company_id,
    free_plan_id,
    'active',
    CURRENT_DATE,
    CURRENT_DATE + interval '1 year'
  );

  -- Optionally update the plan's user limit for this specific assignment
  IF user_limit_override > 1 THEN
    UPDATE subscription_plans
    SET user_limit = user_limit_override
    WHERE id = free_plan_id;
  END IF;

  result := json_build_object(
    'success', true,
    'message', 'Free plan assigned successfully',
    'company_id', target_company_id,
    'plan_name', 'Free',
    'user_limit', user_limit_override
  );

  RETURN result;
END;
$$;

-- Create a function to list companies for free plan assignment
CREATE OR REPLACE FUNCTION list_companies_for_free_plan()
RETURNS TABLE (
  company_id uuid,
  company_name text,
  current_plan text,
  active_users bigint,
  subscription_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the calling user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can view company list';
  END IF;

  RETURN QUERY
  SELECT 
    c.id as company_id,
    c.name as company_name,
    COALESCE(sp.name, 'No Plan') as current_plan,
    (
      SELECT COUNT(*)::bigint 
      FROM profiles p 
      WHERE p.company_id = c.id 
      AND p.is_active = true
    ) as active_users,
    COALESCE(cs.status, 'none') as subscription_status
  FROM companies c
  LEFT JOIN company_subscriptions cs ON c.id = cs.company_id AND cs.status = 'active'
  LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
  ORDER BY c.name;
END;
$$;