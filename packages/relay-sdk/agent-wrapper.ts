import type { AgentActionType } from '@relay/shared'
import type { RelaySqliteWriter } from './sqlite-writer'
import type { RelayControlListener } from './control-listener'
import type { RelayDriftDetector } from './drift-detector'

export class RelayAgentWrapper {
  private readonly writer: RelaySqliteWriter
  private readonly control: RelayControlListener
  private readonly drift: RelayDriftDetector

  constructor(
    writer: RelaySqliteWriter,
    control: RelayControlListener,
    drift: RelayDriftDetector
  ) {
    this.writer = writer
    this.control = control
    this.drift = drift
  }

  async logAction(
    type: AgentActionType,
    title: string,
    detail: string,
    screenshotB64: string | null = null
  ): Promise<string> {
    const actionId = await this.writer.logAction(type, title, detail, screenshotB64)
    await this.drift.recordAction(`${type}: ${title}`)
    return actionId
  }

  async logReasoning(thought: string, actionId: string): Promise<string> {
    return this.writer.logReasoning(thought, actionId)
  }

  async checkControl(): Promise<{
    stopRequested: boolean
    redirectInstruction: string | null
  }> {
    await this.control.waitWhilePaused()

    const snapshot = this.control.snapshot()
    return {
      stopRequested: snapshot.stopRequested,
      redirectInstruction: this.control.consumeRedirectInstruction(),
    }
  }
}
