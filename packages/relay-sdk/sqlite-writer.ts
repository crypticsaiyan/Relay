import { randomUUID } from 'node:crypto'
import type { PowerSyncDatabase } from '@powersync/node'
import type {
  AgentActionType,
  AgentSessionStatus,
} from '@relay/shared'

export type SessionBootstrapInput = {
  name: string
  agentId: string
  userId: string
  originalTask: string
  deviceName: string
}

type SourceDbClient = {
  query: <Row = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{
    rows?: Row[]
  } | unknown>
}

export class RelaySqliteWriter {
  private readonly db: PowerSyncDatabase
  private readonly sessionId: string
  private readonly sourceDbClient: SourceDbClient | null

  constructor(db: PowerSyncDatabase, sessionId: string, sourceDbClient?: SourceDbClient | null) {
    this.db = db
    this.sessionId = sessionId
    this.sourceDbClient = sourceDbClient ?? null
  }

  async initializeSchema(): Promise<void> {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        original_task TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        device_name TEXT,
        share_token TEXT
      )
    `)

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS agent_actions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT,
        screenshot_b64 TEXT,
        created_at TEXT NOT NULL,
        sequence_number INTEGER NOT NULL
      )
    `)

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS agent_reasoning (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        thought TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `)

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS control_commands (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        command TEXT NOT NULL,
        payload TEXT,
        issued_by TEXT NOT NULL,
        issued_at TEXT NOT NULL,
        executed_at TEXT
      )
    `)

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS drift_alerts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        original_task TEXT NOT NULL,
        current_action TEXT NOT NULL,
        drift_score REAL NOT NULL,
        explanation TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `)
  }

  async createSession(input: SessionBootstrapInput): Promise<void> {
    const startedAt = new Date().toISOString()

    await this.db.execute(
      `
        INSERT OR REPLACE INTO agent_sessions (
          id,
          name,
          agent_id,
          user_id,
          status,
          original_task,
          started_at,
          completed_at,
          device_name,
          share_token
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        this.sessionId,
        input.name,
        input.agentId,
        input.userId,
        'running',
        input.originalTask,
        startedAt,
        null,
        input.deviceName,
        null,
      ]
    )

    if (this.sourceDbClient) {
      await this.sourceDbClient.query(
        `
          INSERT INTO agent_sessions (
            id,
            name,
            agent_id,
            user_id,
            status,
            original_task,
            started_at,
            completed_at,
            device_name,
            share_token
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            agent_id = EXCLUDED.agent_id,
            user_id = EXCLUDED.user_id,
            status = EXCLUDED.status,
            original_task = EXCLUDED.original_task,
            started_at = EXCLUDED.started_at,
            completed_at = EXCLUDED.completed_at,
            device_name = EXCLUDED.device_name,
            share_token = EXCLUDED.share_token
        `,
        [
          this.sessionId,
          input.name,
          input.agentId,
          input.userId,
          'running',
          input.originalTask,
          startedAt,
          null,
          input.deviceName,
          null,
        ]
      )
    }
  }

  async updateSessionStatus(status: AgentSessionStatus): Promise<void> {
    await this.db.execute(
      'UPDATE agent_sessions SET status = ? WHERE id = ?',
      [status, this.sessionId]
    )

    if (this.sourceDbClient) {
      await this.sourceDbClient.query(
        'UPDATE agent_sessions SET status = $1 WHERE id = $2',
        [status, this.sessionId]
      )
    }
  }

  async completeSession(finalStatus: AgentSessionStatus = 'completed'): Promise<void> {
    const completedAt = new Date().toISOString()

    await this.db.execute(
      'UPDATE agent_sessions SET status = ?, completed_at = ? WHERE id = ?',
      [finalStatus, completedAt, this.sessionId]
    )

    if (this.sourceDbClient) {
      await this.sourceDbClient.query(
        'UPDATE agent_sessions SET status = $1, completed_at = $2 WHERE id = $3',
        [finalStatus, completedAt, this.sessionId]
      )
    }
  }

  async logAction(
    type: AgentActionType,
    title: string,
    detail: string,
    screenshotB64: string | null = null
  ): Promise<string> {
    const id = randomUUID()
    const createdAt = new Date().toISOString()
    const sequenceNumber = await this.getNextSequenceNumber()

    await this.db.execute(
      `
        INSERT INTO agent_actions (
          id,
          session_id,
          type,
          title,
          detail,
          screenshot_b64,
          created_at,
          sequence_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        this.sessionId,
        type,
        title,
        detail,
        screenshotB64,
        createdAt,
        sequenceNumber,
      ]
    )

    if (this.sourceDbClient) {
      await this.sourceDbClient.query(
        `
          INSERT INTO agent_actions (
            id,
            session_id,
            type,
            title,
            detail,
            screenshot_b64,
            created_at,
            sequence_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          id,
          this.sessionId,
          type,
          title,
          detail,
          screenshotB64,
          createdAt,
          sequenceNumber,
        ]
      )
    }

    if (type === 'screenshot') {
      await this.pruneOldScreenshots(50)
    }

    return id
  }

  async logReasoning(thought: string, actionId: string): Promise<string> {
    const id = randomUUID()
    const createdAt = new Date().toISOString()

    await this.db.execute(
      `
        INSERT INTO agent_reasoning (
          id,
          session_id,
          action_id,
          thought,
          created_at
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [id, this.sessionId, actionId, thought, createdAt]
    )

    if (this.sourceDbClient) {
      await this.sourceDbClient.query(
        `
          INSERT INTO agent_reasoning (
            id,
            session_id,
            action_id,
            thought,
            created_at
          ) VALUES ($1, $2, $3, $4, $5)
        `,
        [id, this.sessionId, actionId, thought, createdAt]
      )
    }

    return id
  }

  async logDriftAlert(
    originalTask: string,
    currentAction: string,
    driftScore: number,
    explanation: string
  ): Promise<void> {
    const id = randomUUID()
    const createdAt = new Date().toISOString()

    await this.db.execute(
      `
        INSERT INTO drift_alerts (
          id,
          session_id,
          original_task,
          current_action,
          drift_score,
          explanation,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        this.sessionId,
        originalTask,
        currentAction,
        driftScore,
        explanation,
        createdAt,
      ]
    )

    if (this.sourceDbClient) {
      await this.sourceDbClient.query(
        `
          INSERT INTO drift_alerts (
            id,
            session_id,
            original_task,
            current_action,
            drift_score,
            explanation,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          id,
          this.sessionId,
          originalTask,
          currentAction,
          driftScore,
          explanation,
          createdAt,
        ]
      )
    }
  }

  async getPendingControlCommand(): Promise<{
    id: string
    command: 'pause' | 'resume' | 'stop' | 'redirect'
    payload: string | null
    issuedBy: string
  } | null> {
    const row = await this.db.getOptional<{
      id: string
      command: 'pause' | 'resume' | 'stop' | 'redirect'
      payload: string | null
      issued_by: string
    }>(
      `
        SELECT id, command, payload, issued_by
        FROM control_commands
        WHERE session_id = ? AND executed_at IS NULL
        ORDER BY issued_at ASC
        LIMIT 1
      `,
      [this.sessionId]
    )

    if (!row) {
      const sourceRow = await this.getPendingControlCommandFromSource()
      if (!sourceRow) {
        return null
      }

      return {
        id: sourceRow.id,
        command: sourceRow.command,
        payload: sourceRow.payload,
        issuedBy: sourceRow.issued_by,
      }
    }

    return {
      id: row.id,
      command: row.command,
      payload: row.payload,
      issuedBy: row.issued_by,
    }
  }

  async markControlCommandExecuted(commandId: string): Promise<void> {
    const executedAt = new Date().toISOString()

    await this.db.execute(
      'UPDATE control_commands SET executed_at = ? WHERE id = ?',
      [executedAt, commandId]
    )

    if (this.sourceDbClient) {
      await this.sourceDbClient.query(
        'UPDATE control_commands SET executed_at = $1 WHERE id = $2',
        [executedAt, commandId]
      )
    }
  }

  private async getPendingControlCommandFromSource(): Promise<{
    id: string
    command: 'pause' | 'resume' | 'stop' | 'redirect'
    payload: string | null
    issued_by: string
  } | null> {
    if (!this.sourceDbClient) {
      return null
    }

    const result = await this.sourceDbClient.query<{
      id: string
      command: 'pause' | 'resume' | 'stop' | 'redirect'
      payload: string | null
      issued_by: string
    }>(
      `
        SELECT id, command, payload, issued_by
        FROM control_commands
        WHERE session_id = $1 AND executed_at IS NULL
        ORDER BY issued_at ASC
        LIMIT 1
      `,
      [this.sessionId]
    )

    const rows = (
      result &&
      typeof result === 'object' &&
      'rows' in result &&
      Array.isArray(result.rows)
    )
      ? result.rows
      : []

    return rows[0] ?? null
  }

  private async getNextSequenceNumber(): Promise<number> {
    const result = await this.db.getOptional<{ next_sequence: number }>(
      'SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence FROM agent_actions WHERE session_id = ?',
      [this.sessionId]
    )

    return result?.next_sequence ?? 1
  }

  private async pruneOldScreenshots(maxScreenshots: number): Promise<void> {
    await this.db.execute(
      `
        DELETE FROM agent_actions
        WHERE id IN (
          SELECT id
          FROM agent_actions
          WHERE session_id = ? AND type = 'screenshot'
          ORDER BY created_at DESC
          LIMIT -1 OFFSET ?
        )
      `,
      [this.sessionId, maxScreenshots]
    )
  }
}
