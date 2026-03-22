import ollama from 'ollama'
import type { RelaySqliteWriter } from './sqlite-writer'

type DriftAssessment = {
  drifted: boolean
  score: number
  explanation: string
}

export class RelayDriftDetector {
  private readonly writer: RelaySqliteWriter
  private readonly originalTask: string
  private readonly actionWindow: string[] = []
  private readonly runEveryActions: number

  constructor(writer: RelaySqliteWriter, originalTask: string, runEveryActions = 10) {
    this.writer = writer
    this.originalTask = originalTask
    this.runEveryActions = runEveryActions
  }

  async recordAction(actionSummary: string): Promise<void> {
    this.actionWindow.push(actionSummary)
    if (this.actionWindow.length > 10) {
      this.actionWindow.shift()
    }

    if (this.actionWindow.length < this.runEveryActions) {
      return
    }

    const result = await this.checkDrift()
    if (result.score > 0.6) {
      await this.writer.logDriftAlert(
        this.originalTask,
        this.actionWindow[this.actionWindow.length - 1] ?? 'unknown action',
        result.score,
        result.explanation
      )
    }

    this.actionWindow.splice(0, this.actionWindow.length)
  }

  private async checkDrift(): Promise<DriftAssessment> {
    const model = process.env.OLLAMA_MODEL ?? 'llama3.2'

    const response = await ollama.chat({
      model,
      messages: [
        {
          role: 'user',
          content:
            `Original task: ${this.originalTask}\n\n` +
            `Recent agent actions:\n${this.actionWindow.join('\n')}\n\n` +
            'Has the agent drifted from the original task? ' +
            'Respond with JSON only: {"drifted": boolean, "score": number, "explanation": string}',
        },
      ],
    })

    try {
      const parsed = JSON.parse(response.message.content) as DriftAssessment
      return {
        drifted: Boolean(parsed.drifted),
        score: Number(parsed.score),
        explanation: String(parsed.explanation ?? 'No explanation provided'),
      }
    } catch {
      return {
        drifted: false,
        score: 0,
        explanation: 'Drift detector returned invalid JSON',
      }
    }
  }
}
