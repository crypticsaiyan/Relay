CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  original_task TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  device_name TEXT,
  share_token TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  screenshot_b64 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sequence_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_reasoning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id),
  action_id UUID REFERENCES agent_actions(id),
  thought TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS control_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id),
  command TEXT NOT NULL,
  payload TEXT,
  issued_by TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS drift_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id),
  original_task TEXT NOT NULL,
  current_action TEXT NOT NULL,
  drift_score REAL NOT NULL,
  explanation TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchers (
  session_id UUID REFERENCES agent_sessions(id),
  user_id TEXT NOT NULL,
  device_type TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_session_sequence
  ON agent_actions(session_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_agent_actions_created_at
  ON agent_actions(created_at);

CREATE INDEX IF NOT EXISTS idx_control_commands_session_executed
  ON control_commands(session_id, executed_at);

CREATE INDEX IF NOT EXISTS idx_drift_alerts_session_id
  ON drift_alerts(session_id);
