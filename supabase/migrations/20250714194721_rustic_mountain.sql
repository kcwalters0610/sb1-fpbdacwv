/*
  # Create conversations and participants tables

  1. New Tables
    - `conversations`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `type` (text, either 'direct' or 'group')
      - `title` (text, optional for group chats)
      - `created_by` (uuid, foreign key to profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `conversation_participants`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, foreign key to conversations)
      - `user_id` (uuid, foreign key to profiles)
      - `last_read_at` (timestamp)
      - `created_at` (timestamp)
    - `messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, foreign key to conversations)
      - `sender_id` (uuid, foreign key to profiles)
      - `content` (text)
      - `created_at` (timestamp)
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage conversations they participate in
*/

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('direct', 'group')),
  title text,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create conversation_participants table
CREATE TABLE IF NOT EXISTS conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX conversations_company_id_idx ON conversations(company_id);
CREATE INDEX conversations_created_by_idx ON conversations(created_by);
CREATE INDEX conversation_participants_conversation_id_idx ON conversation_participants(conversation_id);
CREATE INDEX conversation_participants_user_id_idx ON conversation_participants(user_id);
CREATE INDEX messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX messages_sender_id_idx ON messages(sender_id);
CREATE INDEX messages_created_at_idx ON messages(created_at);

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for conversations
CREATE POLICY "Users can view conversations they participate in" 
  ON conversations 
  FOR SELECT 
  TO authenticated 
  USING (
    id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create conversations in their company" 
  ON conversations 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    created_by = auth.uid() AND
    company_id IN (
      SELECT company_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update conversations they created" 
  ON conversations 
  FOR UPDATE 
  TO authenticated 
  USING (created_by = auth.uid());

-- Create policies for conversation_participants
CREATE POLICY "Users can view conversation participants" 
  ON conversation_participants 
  FOR SELECT 
  TO authenticated 
  USING (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add participants to conversations they created" 
  ON conversation_participants 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    conversation_id IN (
      SELECT id 
      FROM conversations 
      WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their own participant status" 
  ON conversation_participants 
  FOR UPDATE 
  TO authenticated 
  USING (user_id = auth.uid());

-- Create policies for messages
CREATE POLICY "Users can view messages in conversations they participate in" 
  ON messages 
  FOR SELECT 
  TO authenticated 
  USING (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to conversations they participate in" 
  ON messages 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

-- Create trigger to update conversations.updated_at when a new message is added
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_timestamp
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_timestamp();