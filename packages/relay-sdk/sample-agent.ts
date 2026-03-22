import { setTimeout as sleep } from 'node:timers/promises'
import type { AgentActionType } from '@relay/shared'
import { appendRelayStructuredData, type RelayStructuredDataPayload } from '@relay/shared'
import type { RelayAgentWrapper } from './agent-wrapper'

export type AgentDecision = {
  type: AgentActionType
  title: string
  detail: string
  reasoning: string
  waitMs: number
}

export type DecisionExecutionResult = {
  detailSuffix?: string
  reasoningSuffix?: string
  waitMsOverride?: number
  screenshotB64?: string | null
  structuredData?: RelayStructuredDataPayload | null
}

export type SampleAgentLoopResult =
  | 'stop-requested'
  | 'browser-closed'
  | 'dry-run-complete'
  | 'max-steps-reached'

export type SampleAgentLoopOptions = {
  relay: RelayAgentWrapper
  initialTask: string
  captureScreenshot?: () => Promise<string | null>
  observe?: () => Promise<string | null>
  planDecision?: (input: {
    task: string
    step: number
    screenshotB64: string | null
    observation: string | null
    fallbackWaitMs: number
  }) => Promise<AgentDecision>
  applyDecision?: (decision: AgentDecision) => Promise<DecisionExecutionResult | void>
  defaultWaitMs?: number
  dryRun?: boolean
  maxSteps?: number
}

const DEFAULT_WAIT_MS = 2000

export async function runSampleAgentLoop(
  options: SampleAgentLoopOptions
): Promise<SampleAgentLoopResult> {
  const relay = options.relay
  const defaultWaitMs = options.defaultWaitMs ?? DEFAULT_WAIT_MS
  const maxSteps = options.maxSteps ?? null
  const dryRun = options.dryRun ?? false

  let activeTask = options.initialTask
  let step = 0

  while (true) {
    const controlState = await relay.checkControl()

    if (controlState.stopRequested) {
      const actionId = await relay.logAction(
        'stop',
        'Stop command acknowledged',
        'Sample agent received stop from control_commands'
      )
      await relay.logReasoning('Stopping loop immediately due to operator control.', actionId)
      return 'stop-requested'
    }

    if (controlState.redirectInstruction) {
      activeTask = controlState.redirectInstruction
      step = -1
      const actionId = await relay.logAction(
        'redirect',
        'Task redirected by operator',
        activeTask
      )
      await relay.logReasoning(
        'Updated active task context based on redirect command and restarted planning from the first step.',
        actionId
      )
    }

    let screenshotB64: string | null = null
    if (options.captureScreenshot) {
      try {
        screenshotB64 = await options.captureScreenshot()
      } catch (error) {
        if (isClosedBrowserError(error)) {
          const actionId = await relay.logAction(
            'stop',
            'Browser session closed',
            String(error)
          )
          await relay.logReasoning('Stopping the agent loop because the controlled browser is no longer available.', actionId)
          return 'browser-closed'
        }

        const actionId = await relay.logAction(
          'wait',
          'Screenshot capture failed',
          String(error)
        )
        await relay.logReasoning('Continuing loop without screenshot input for this step.', actionId)
      }
    }

    let observation: string | null = null
    if (options.observe) {
      try {
        observation = await options.observe()
      } catch (error) {
        if (isClosedBrowserError(error)) {
          const actionId = await relay.logAction(
            'stop',
            'Browser session closed',
            String(error)
          )
          await relay.logReasoning('Stopping the agent loop because the controlled browser is no longer available.', actionId)
          return 'browser-closed'
        }

        const actionId = await relay.logAction(
          'wait',
          'Page observation failed',
          String(error)
        )
        await relay.logReasoning('Continuing loop without structured page observation.', actionId)
      }
    }

    const decision = options.planDecision
      ? await options.planDecision({
          task: activeTask,
          step,
          screenshotB64,
          observation,
          fallbackWaitMs: defaultWaitMs,
        })
      : await getAgentDecision({
          task: activeTask,
          step,
          screenshotB64,
          observation,
          fallbackWaitMs: defaultWaitMs,
        })

    let executionResult: DecisionExecutionResult | void = undefined
    if (options.applyDecision) {
      try {
        executionResult = await options.applyDecision(decision)
      } catch (error) {
        if (isClosedBrowserError(error)) {
          const actionId = await relay.logAction(
            'stop',
            'Browser session closed',
            String(error)
          )
          await relay.logReasoning('Stopping the agent loop because the controlled browser closed mid-action.', actionId)
          return 'browser-closed'
        }

        executionResult = {
          detailSuffix: `Execution error: ${String(error)}`,
          reasoningSuffix: 'Decision execution failed at runtime.',
        }
      }
    }

    const actionId = await relay.logAction(
      decision.type,
      decision.title,
      appendRelayStructuredData(
        executionResult?.detailSuffix
          ? `${decision.detail}\n${executionResult.detailSuffix}`
          : decision.detail,
        executionResult?.structuredData
      ),
      executionResult?.screenshotB64 ?? screenshotB64
    )
    await relay.logReasoning(
      executionResult?.reasoningSuffix
        ? `${decision.reasoning}\n${executionResult.reasoningSuffix}`
        : decision.reasoning,
      actionId
    )

    step += 1

    if (dryRun) {
      return 'dry-run-complete'
    }

    if (maxSteps !== null && step >= maxSteps) {
      return 'max-steps-reached'
    }

    await sleep(
      Math.max(
        250,
        executionResult?.waitMsOverride ?? decision.waitMs
      )
    )
  }
}

function isClosedBrowserError(error: unknown): boolean {
  const message = String(error).toLowerCase()
  return (
    message.includes('target page, context or browser has been closed') ||
    message.includes('browser has been closed') ||
    message.includes('page has been closed')
  )
}

async function getAgentDecision(input: {
  task: string
  step: number
  screenshotB64: string | null
  observation: string | null
  fallbackWaitMs: number
}): Promise<AgentDecision> {
  const groqApiKey = process.env.GROQ_API_KEY
  if (groqApiKey) {
    return getGroqDecision({
      ...input,
      apiKey: groqApiKey,
    })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return getLocalFallbackDecision(input)
  }

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const prompt =
    `You are Relay's sample browser agent. Decide one safe next step for this task:\n` +
    `${input.task}\n\n` +
    `Current step: ${Math.max(input.step + 1, 1)}\n` +
    `Observed page state:\n${input.observation ?? 'No structured observation available.'}\n\n` +
    'Return strict JSON only with this shape: ' +
    '{"type":"decide|navigate|click|type|read|wait","title":"...","detail":"...","reasoning":"...","waitMs":2000}.\n' +
    'Keep titles concise and details practical. Do not include markdown.'

  const parts: Array<Record<string, unknown>> = [{ text: prompt }]
  if (input.screenshotB64) {
    parts.push({
      inline_data: {
        mime_type: 'image/jpeg',
        data: input.screenshotB64,
      },
    })
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      return {
        type: 'wait',
        title: 'Gemini request failed',
        detail: `HTTP ${response.status}: ${errBody.slice(0, 500)}`,
        reasoning: 'Falling back to wait because Gemini call did not succeed.',
        waitMs: input.fallbackWaitMs,
      }
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string
          }>
        }
      }>
    }

    const rawText =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('\n')
        .trim() ?? ''

    return normalizeDecision(rawText, input)
  } catch (error) {
    return {
      type: 'wait',
      title: 'Gemini unavailable',
      detail: String(error),
      reasoning: 'Network or parsing failure while requesting model decision.',
      waitMs: input.fallbackWaitMs,
    }
  }
}

async function getGroqDecision(input: {
  apiKey: string
  task: string
  step: number
  screenshotB64: string | null
  observation: string | null
  fallbackWaitMs: number
}): Promise<AgentDecision> {
  const model = process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant'
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions'
  const screenshotHint = input.screenshotB64
    ? 'A screenshot was captured, but this backend receives text-only context.'
    : 'No screenshot was captured for this step.'

  const prompt =
    `You are Relay's sample browser agent. Decide one safe next step for this task:\n` +
    `${input.task}\n\n` +
    `Current step: ${Math.max(input.step + 1, 1)}\n` +
    `Observed page state:\n${input.observation ?? 'No structured observation available.'}\n` +
    `${screenshotHint}\n\n` +
    'Return strict JSON only with this shape: ' +
    '{"type":"decide|navigate|click|type|read|wait","title":"...","detail":"...","reasoning":"...","waitMs":2000}.\n' +
    'Keep titles concise and details practical. Do not include markdown.'

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: {
          type: 'json_object',
        },
        messages: [
          {
            role: 'system',
            content:
              'You are a safe browser automation planner. Output valid JSON only and avoid destructive actions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      return {
        type: 'wait',
        title: 'Groq request failed',
        detail: `HTTP ${response.status}: ${errBody.slice(0, 500)}`,
        reasoning: 'Falling back to wait because Groq call did not succeed.',
        waitMs: input.fallbackWaitMs,
      }
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string
        }
      }>
    }

    const rawText = payload.choices?.[0]?.message?.content?.trim() ?? ''
    return normalizeDecision(rawText, input)
  } catch (error) {
    return {
      type: 'wait',
      title: 'Groq unavailable',
      detail: String(error),
      reasoning: 'Network or parsing failure while requesting Groq decision.',
      waitMs: input.fallbackWaitMs,
    }
  }
}

function getLocalFallbackDecision(input: {
  task: string
  step: number
  observation: string | null
  fallbackWaitMs: number
}): AgentDecision {
  const normalizedStep = Math.max(input.step, 0)
  const observation = (input.observation ?? '').toLowerCase()
  const hasInputs = observation.includes('inputs:')
    && !observation.includes('inputs: none')
  const hasButtons = observation.includes('buttons:')
    && !observation.includes('buttons: none')
  const hasLinks = observation.includes('links:')
    && !observation.includes('links: none')

  if (normalizedStep === 0) {
    return {
      type: 'read',
      title: 'Inspect current page',
      detail: `Review the current website before taking action for task: ${input.task}`,
      reasoning: 'A real browser agent should inspect page structure before clicking or typing.',
      waitMs: input.fallbackWaitMs,
    }
  }

  if (hasInputs && normalizedStep % 3 === 1) {
    return {
      type: 'type',
      title: 'Fill the primary input',
      detail: `Enter a query or form value relevant to: ${input.task}`,
      reasoning: 'An input is available, so the next useful action is to type into the page.',
      waitMs: input.fallbackWaitMs,
    }
  }

  if (hasButtons || hasLinks) {
    return {
      type: 'click',
      title: 'Activate the next visible control',
      detail: `Click the most relevant visible control for task: ${input.task}`,
      reasoning: 'A clickable control is present, so continue the workflow with a real interaction.',
      waitMs: input.fallbackWaitMs,
    }
  }

  return {
    type: 'read',
    title: 'Read updated page state',
    detail: `Capture the latest visible content for task: ${input.task}`,
    reasoning: 'No obvious input or control was detected, so continue observing the page.',
    waitMs: input.fallbackWaitMs,
  }
}

function normalizeDecision(
  rawText: string,
  input: {
    task: string
    step: number
    fallbackWaitMs: number
  }
): AgentDecision {
  try {
    const trimmed = stripJsonFences(rawText)
    const parsed = JSON.parse(trimmed) as Partial<AgentDecision>
    const allowed: AgentActionType[] = ['decide', 'navigate', 'click', 'type', 'read', 'wait']
    const parsedType = String(parsed.type ?? 'decide') as AgentActionType

    return {
      type: allowed.includes(parsedType) ? parsedType : 'decide',
      title: String(parsed.title ?? `Planning step ${Math.max(input.step + 1, 1)}`),
      detail: String(parsed.detail ?? `Continue task: ${input.task}`),
      reasoning: String(parsed.reasoning ?? 'No model reasoning provided.'),
      waitMs: sanitizeWait(parsed.waitMs, input.fallbackWaitMs),
    }
  } catch {
    return {
      type: 'decide',
      title: `Planning step ${Math.max(input.step + 1, 1)}`,
      detail: `Model output could not be parsed as JSON. Raw: ${rawText.slice(0, 500)}`,
      reasoning: 'Using fallback decision due to invalid model JSON output.',
      waitMs: input.fallbackWaitMs,
    }
  }
}

function stripJsonFences(raw: string): string {
  const value = raw.trim()
  if (!value.startsWith('```')) {
    return value
  }

  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

function sanitizeWait(waitMs: unknown, fallback: number): number {
  const parsed = Number(waitMs)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.floor(parsed)
}
