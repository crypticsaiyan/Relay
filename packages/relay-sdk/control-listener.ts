import { setTimeout as sleep } from 'node:timers/promises'
import type { RelaySqliteWriter } from './sqlite-writer'

export type ControlCommandEvent = {
  command: 'pause' | 'resume' | 'stop' | 'redirect'
  payload: string | null
  issuedBy: string
}

export type ControlStateSnapshot = {
  paused: boolean
  stopRequested: boolean
  redirectInstruction: string | null
}

export class RelayControlListener {
  private readonly writer: RelaySqliteWriter
  private readonly pollMs: number
  private readonly onCommandExecuted: ((event: ControlCommandEvent) => Promise<void> | void) | null
  private active = false
  private paused = false
  private stopRequested = false
  private redirectInstruction: string | null = null

  constructor(
    writer: RelaySqliteWriter,
    pollMs = 300,
    onCommandExecuted: ((event: ControlCommandEvent) => Promise<void> | void) | null = null
  ) {
    this.writer = writer
    this.pollMs = pollMs
    this.onCommandExecuted = onCommandExecuted
  }

  start(): void {
    if (this.active) {
      return
    }

    this.active = true
    void this.loop()
  }

  stop(): void {
    this.active = false
  }

  snapshot(): ControlStateSnapshot {
    return {
      paused: this.paused,
      stopRequested: this.stopRequested,
      redirectInstruction: this.redirectInstruction,
    }
  }

  consumeRedirectInstruction(): string | null {
    const payload = this.redirectInstruction
    this.redirectInstruction = null
    return payload
  }

  async waitWhilePaused(): Promise<void> {
    while (this.paused && this.active && !this.stopRequested) {
      await sleep(this.pollMs)
    }
  }

  private async loop(): Promise<void> {
    while (this.active) {
      try {
        const cmd = await this.writer.getPendingControlCommand()

        if (cmd) {
          if (cmd.command === 'pause') {
            this.paused = true
          }

          if (cmd.command === 'resume') {
            this.paused = false
          }

          if (cmd.command === 'stop') {
            this.paused = false
            this.stopRequested = true
          }

          if (cmd.command === 'redirect') {
            this.redirectInstruction = cmd.payload
          }

          await this.writer.markControlCommandExecuted(cmd.id)

          if (this.onCommandExecuted) {
            await this.onCommandExecuted({
              command: cmd.command,
              payload: cmd.payload,
              issuedBy: cmd.issuedBy,
            })
          }
        }
      } catch (error) {
        console.warn(`Relay control listener poll failed: ${String(error)}`)
      }

      if (this.paused) {
        await sleep(this.pollMs)
        continue
      }

      await sleep(this.pollMs)
    }
  }
}
