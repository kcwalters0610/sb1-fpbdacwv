/*
  # Fix time entries duration constraint for timers

  1. Schema Changes
    - Allow `duration_minutes` to be NULL for ongoing timers
    - Allow `end_time` to be NULL for ongoing timers
    - Update check constraint to allow NULL or positive values

  2. Security
    - Maintain existing RLS policies
    - Keep data integrity for completed entries
*/

-- Drop the existing check constraint
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_duration_check;

-- Allow duration_minutes to be NULL (for ongoing timers)
ALTER TABLE time_entries ALTER COLUMN duration_minutes DROP NOT NULL;

-- Allow end_time to be NULL (for ongoing timers)
ALTER TABLE time_entries ALTER COLUMN end_time DROP NOT NULL;

-- Add new check constraint that allows NULL or positive values
ALTER TABLE time_entries ADD CONSTRAINT time_entries_duration_check 
CHECK (duration_minutes IS NULL OR duration_minutes > 0);