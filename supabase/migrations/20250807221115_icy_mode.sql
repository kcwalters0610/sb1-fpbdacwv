/*
  # Create invoice payments table

  1. New Tables
    - `invoice_payments`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key to invoices)
      - `amount` (numeric, payment amount)
      - `payment_method` (text, method of payment)
      - `payment_date` (date, when payment was made)
      - `reference_number` (text, check number, transaction ID, etc.)
      - `notes` (text, additional payment notes)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `invoice_payments` table
    - Add policies for company-based access
    - Users can manage payments for invoices in their company

  3. Indexes
    - Index on invoice_id for fast lookups
    - Index on payment_date for reporting
*/

CREATE TABLE IF NOT EXISTS invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_number text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Add constraint to ensure payment method is valid
ALTER TABLE invoice_payments 
ADD CONSTRAINT invoice_payments_payment_method_check 
CHECK (payment_method IN ('cash', 'check', 'credit_card', 'bank_transfer', 'ach', 'other'));

-- Add constraint to ensure amount is positive
ALTER TABLE invoice_payments 
ADD CONSTRAINT invoice_payments_amount_check 
CHECK (amount > 0);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS invoice_payments_invoice_id_idx ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_payments_payment_date_idx ON invoice_payments(payment_date);

-- Enable RLS
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view payments for invoices in their company"
  ON invoice_payments
  FOR SELECT
  TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage payments for invoices in their company"
  ON invoice_payments
  FOR ALL
  TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );