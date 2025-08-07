/*
  # Add Subscription Management Tables

  1. New Tables
    - `subscription_plans` - Available subscription plans with pricing
    - `company_subscriptions` - Company subscription records
    - `subscription_usage` - Track user count and usage
    - `subscription_invoices` - Subscription billing records

  2. Security
    - Enable RLS on all subscription tables
    - Add policies for company-specific access
    - Admin-only access for subscription management

  3. Features
    - Multiple pricing tiers (Starter, Pro, Business)
    - User limits per plan
    - Overage billing at $20/user/month
    - Subscription status tracking
*/

-- Create subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  monthly_price numeric(10,2) NOT NULL DEFAULT 0,
  user_limit integer NOT NULL DEFAULT 1,
  overage_price numeric(10,2) NOT NULL DEFAULT 20.00,
  features jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create company subscriptions table
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'suspended')),
  current_period_start date NOT NULL DEFAULT CURRENT_DATE,
  current_period_end date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
  trial_end date,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscription usage tracking table
CREATE TABLE IF NOT EXISTS subscription_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  active_users integer NOT NULL DEFAULT 0,
  plan_user_limit integer NOT NULL DEFAULT 0,
  overage_users integer NOT NULL DEFAULT 0,
  base_amount numeric(10,2) NOT NULL DEFAULT 0,
  overage_amount numeric(10,2) NOT NULL DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscription invoices table
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES company_subscriptions(id) ON DELETE CASCADE,
  usage_id uuid REFERENCES subscription_usage(id),
  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(10,2) NOT NULL DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, monthly_price, user_limit, overage_price, features) VALUES
('Starter', 'Perfect for small teams getting started', 99.00, 3, 20.00, '{"work_orders": true, "customers": true, "basic_reports": true}'),
('Pro', 'Advanced features for growing businesses', 199.00, 5, 20.00, '{"work_orders": true, "customers": true, "projects": true, "inventory": true, "advanced_reports": true, "crm": true}'),
('Business', 'Complete solution for larger organizations', 399.00, 10, 20.00, '{"work_orders": true, "customers": true, "projects": true, "inventory": true, "advanced_reports": true, "crm": true, "multi_location": true, "api_access": true}');

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (public read access)
CREATE POLICY "Anyone can view subscription plans"
  ON subscription_plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies for company_subscriptions
CREATE POLICY "Companies can view their own subscription"
  ON company_subscriptions
  FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage company subscription"
  ON company_subscriptions
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for subscription_usage
CREATE POLICY "Companies can view their own usage"
  ON subscription_usage
  FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "System can manage usage records"
  ON subscription_usage
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for subscription_invoices
CREATE POLICY "Companies can view their own subscription invoices"
  ON subscription_invoices
  FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage subscription invoices"
  ON subscription_invoices
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS company_subscriptions_company_id_idx ON company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS company_subscriptions_status_idx ON company_subscriptions(status);
CREATE INDEX IF NOT EXISTS subscription_usage_company_id_idx ON subscription_usage(company_id);
CREATE INDEX IF NOT EXISTS subscription_usage_billing_period_idx ON subscription_usage(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS subscription_invoices_company_id_idx ON subscription_invoices(company_id);
CREATE INDEX IF NOT EXISTS subscription_invoices_status_idx ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS subscription_invoices_due_date_idx ON subscription_invoices(due_date);

-- Function to calculate subscription usage and billing
CREATE OR REPLACE FUNCTION calculate_subscription_usage(
  company_id_param uuid,
  period_start date,
  period_end date
) RETURNS TABLE (
  active_users integer,
  plan_user_limit integer,
  overage_users integer,
  base_amount numeric,
  overage_amount numeric,
  total_amount numeric
) AS $$
DECLARE
  user_count integer;
  plan_limit integer;
  plan_price numeric;
  overage_price numeric;
  overage_count integer;
  base_cost numeric;
  overage_cost numeric;
  total_cost numeric;
BEGIN
  -- Get active user count for the company
  SELECT COUNT(*) INTO user_count
  FROM profiles 
  WHERE profiles.company_id = company_id_param 
    AND is_active = true;

  -- Get current subscription plan details
  SELECT sp.user_limit, sp.monthly_price, sp.overage_price
  INTO plan_limit, plan_price, overage_price
  FROM company_subscriptions cs
  JOIN subscription_plans sp ON cs.plan_id = sp.id
  WHERE cs.company_id = company_id_param 
    AND cs.status = 'active'
  LIMIT 1;

  -- If no active subscription found, use default values
  IF plan_limit IS NULL THEN
    plan_limit := 3;
    plan_price := 99.00;
    overage_price := 20.00;
  END IF;

  -- Calculate overage
  overage_count := GREATEST(0, user_count - plan_limit);
  
  -- Calculate costs
  base_cost := plan_price;
  overage_cost := overage_count * overage_price;
  total_cost := base_cost + overage_cost;

  RETURN QUERY SELECT 
    user_count,
    plan_limit,
    overage_count,
    base_cost,
    overage_cost,
    total_cost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update company subscription plan
CREATE OR REPLACE FUNCTION update_company_subscription_plan(
  company_id_param uuid,
  new_plan_id uuid
) RETURNS boolean AS $$
DECLARE
  current_subscription_id uuid;
BEGIN
  -- Get current subscription
  SELECT id INTO current_subscription_id
  FROM company_subscriptions
  WHERE company_id = company_id_param AND status = 'active'
  LIMIT 1;

  IF current_subscription_id IS NOT NULL THEN
    -- Update existing subscription
    UPDATE company_subscriptions
    SET 
      plan_id = new_plan_id,
      updated_at = now()
    WHERE id = current_subscription_id;
  ELSE
    -- Create new subscription
    INSERT INTO company_subscriptions (company_id, plan_id, status)
    VALUES (company_id_param, new_plan_id, 'active');
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;