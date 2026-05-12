-- Migration 004: CRA Chat Session Schema
-- Creates tables for the conversational CRA compliance chat agent.
-- All tables are bank-scoped via RLS.

-- cra.chat_sessions: links a conversation to a NarrativeWriter run
CREATE TABLE cra.chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_id UUID NOT NULL,
  narrative_session_id TEXT NOT NULL,  -- references cra.generated_narratives.session_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE cra.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_sessions_bank_isolation ON cra.chat_sessions
  USING (bank_id = current_setting('app.current_bank_id')::UUID);
CREATE INDEX idx_chat_sessions_bank ON cra.chat_sessions (bank_id);
CREATE INDEX idx_chat_sessions_narrative ON cra.chat_sessions (narrative_session_id);

-- cra.chat_messages: full conversation history, append-only
CREATE TABLE cra.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES cra.chat_sessions(id),
  bank_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE cra.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_bank_isolation ON cra.chat_messages
  USING (bank_id = current_setting('app.current_bank_id')::UUID);
-- Append-only: INSERT allowed, no UPDATE/DELETE
CREATE POLICY chat_messages_insert ON cra.chat_messages
  FOR INSERT WITH CHECK (true);
CREATE INDEX idx_chat_messages_session ON cra.chat_messages (session_id);
CREATE INDEX idx_chat_messages_created ON cra.chat_messages (created_at ASC);
