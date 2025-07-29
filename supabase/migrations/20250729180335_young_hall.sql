/*
  # Add resolution notes to work orders

  1. Changes
    - Add `resolution_notes` column to work_orders table
    - This will store what the technician did to complete the work order

  2. Security
    - No changes to RLS policies needed as existing policies cover this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'resolution_notes'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN resolution_notes text;
  END IF;
END $$;