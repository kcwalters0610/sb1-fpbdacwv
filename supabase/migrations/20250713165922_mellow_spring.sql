/*
  # Add department_id column to work_orders table

  1. Changes
    - Add `department_id` column to `work_orders` table
    - Add foreign key constraint to `departments` table
    - Add index for better query performance

  2. Security
    - No changes to RLS policies needed as they already cover the table
*/

-- Add department_id column to work_orders table
ALTER TABLE work_orders 
ADD COLUMN department_id uuid REFERENCES departments(id);

-- Add index for better query performance
CREATE INDEX work_orders_department_id_idx ON work_orders(department_id);