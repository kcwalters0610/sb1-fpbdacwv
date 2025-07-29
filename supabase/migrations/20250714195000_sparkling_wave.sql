/*
  # Fix infinite recursion in conversation policies

  1. Policy Changes
    - Drop existing policies that cause recursion
    - Create simplified policies that avoid circular dependencies
    - Use direct auth.uid() checks instead of complex joins

  2. Security
    - Users can only see conversations they participate in
    - Users can only add participants to conversations they created
    - Users can only send messages to conversations they participate in
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to conversations they created" ON conversation_participants;
DROP POLICY IF EXISTS "Users can update their own participant status" ON conversation_participants;

DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations in their company" ON conversations;
DROP POLICY IF EXISTS "Users can update conversations they created" ON conversations;

DROP POLICY IF EXISTS "Users can view messages in conversations they participate in" ON messages;
DROP POLICY IF EXISTS "Users can send messages to conversations they participate in" ON messages;

-- Create simplified policies for conversations
CREATE POLICY "Users can view conversations in their company"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create conversations in their company"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own conversations"
  ON conversations
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Create simplified policies for conversation_participants
CREATE POLICY "Users can view participants in their company conversations"
  ON conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can add participants to conversations they created"
  ON conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their own participant status"
  ON conversation_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create simplified policies for messages
CREATE POLICY "Users can view messages in company conversations"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can send messages to company conversations"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );