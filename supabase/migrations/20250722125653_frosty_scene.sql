/*
  # Update work order status constraint to include 'open'

  1. Changes
    - Drop existing status check constraint
    - Add new constraint that includes 'open' status
    - Update work order type definition

  2. Security
    - No RLS changes needed
*/

-- Drop the existing constraint
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;

-- Add the new constraint with 'open' included
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check 
  CHECK (status = ANY (ARRAY['open'::text, 'scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]));