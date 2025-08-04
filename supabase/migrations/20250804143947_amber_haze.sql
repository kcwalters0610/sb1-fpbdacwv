/*
  # Add Double Time Support to Labor Rates

  1. Schema Changes
    - Add `double_time_rate` column to `labor_rates` table
    - Set default value and constraints

  2. Security
    - No changes to RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'labor_rates' AND column_name = 'double_time_rate'
  ) THEN
    ALTER TABLE labor_rates ADD COLUMN double_time_rate numeric(10,2) DEFAULT 0.00;
  END IF;
END $$;

-- Add constraint to ensure double_time_rate is non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'labor_rates_double_time_rate_check'
  ) THEN
    ALTER TABLE labor_rates ADD CONSTRAINT labor_rates_double_time_rate_check CHECK (double_time_rate >= 0::numeric);
  END IF;
END $$;