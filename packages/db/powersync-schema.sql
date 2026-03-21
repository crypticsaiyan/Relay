-- PowerSync local SQLite mirror schema.
-- These tables mirror Neon table names and columns so sync streams can map 1:1.

CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  original_task TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  device_name TEXT,
  share_token TEXT
);

CREATE TABLE IF NOT EXISTS agent_actions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  screenshot_b64 TEXT,
  created_at TEXT,
  sequence_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_reasoning (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  thought TEXT NOT NULL,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS control_commands (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  command TEXT NOT NULL,
  payload TEXT,
  issued_by TEXT NOT NULL,
  issued_at TEXT,
  executed_at TEXT
);

CREATE TABLE IF NOT EXISTS drift_alerts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  original_task TEXT NOT NULL,
  current_action TEXT NOT NULL,
  drift_score REAL NOT NULL,
  explanation TEXT NOT NULL,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS watchers (
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  device_type TEXT,
  joined_at TEXT,
  last_seen_at TEXT,
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
