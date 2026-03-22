import type { AgentDecision } from './sample-agent'

export type MockWorkflowName = 'mock-form' | 'mock-email' | 'mock-scrape'

type WorkflowPlannerInput = {
  task: string
  step: number
  screenshotB64: string | null
  observation: string | null
  fallbackWaitMs: number
}

const WORKFLOWS: Record<MockWorkflowName, AgentDecision[]> = {
  'mock-form': [
    {
      type: 'read',
      title: 'Inspect intake form',
      detail: 'Read the visible form fields and confirmation state.',
      reasoning: 'Start by confirming the form layout before entering values.',
      waitMs: 1200,
    },
    {
      type: 'type',
      title: 'Enter lead name',
      detail: 'target=#lead-name value="Ava Patel"',
      reasoning: 'Populate the contact name field first.',
      waitMs: 900,
    },
    {
      type: 'type',
      title: 'Enter work email',
      detail: 'target=#lead-email value="ava.patel@relay.dev"',
      reasoning: 'Add a mock work email so the form has a complete identity.',
      waitMs: 900,
    },
    {
      type: 'type',
      title: 'Enter company name',
      detail: 'target=#lead-company value="Relay Labs"',
      reasoning: 'Company context is required for the mock qualification form.',
      waitMs: 900,
    },
    {
      type: 'type',
      title: 'Describe the use case',
      detail: 'target=#lead-use-case value="Need live visibility into browser agents filling forms and handling tasks in real time."',
      reasoning: 'The use case explains why the agent monitoring product matters.',
      waitMs: 1000,
    },
    {
      type: 'click',
      title: 'Submit the mock lead form',
      detail: 'target=#submit-lead',
      reasoning: 'Submit once all required fields are filled.',
      waitMs: 1200,
    },
    {
      type: 'read',
      title: 'Read the submission confirmation',
      detail: 'Capture the confirmation banner and recorded lead summary.',
      reasoning: 'A final read verifies the form workflow actually completed.',
      waitMs: 1500,
    },
  ],
  'mock-email': [
    {
      type: 'read',
      title: 'Inspect the inbox shell',
      detail: 'Read the inbox counters and visible compose affordance.',
      reasoning: 'Start by confirming the email shell is loaded.',
      waitMs: 1200,
    },
    {
      type: 'click',
      title: 'Open compose panel',
      detail: 'target=#compose-button',
      reasoning: 'Reveal the draft composer before filling email fields.',
      waitMs: 1000,
    },
    {
      type: 'type',
      title: 'Enter recipient',
      detail: 'target=#mail-to value="ops@relay.dev"',
      reasoning: 'Address the message to the mock operations inbox.',
      waitMs: 900,
    },
    {
      type: 'type',
      title: 'Enter subject line',
      detail: 'target=#mail-subject value="Relay live agent demo update"',
      reasoning: 'Set a clear subject so the outbox entry is recognizable.',
      waitMs: 900,
    },
    {
      type: 'type',
      title: 'Write the email body',
      detail: 'target=#mail-body value="The mock browser agent completed the monitored workflow and streamed every step back to Relay in real time."',
      reasoning: 'The body should summarize the completed demo run.',
      waitMs: 1100,
    },
    {
      type: 'click',
      title: 'Send the mock email',
      detail: 'target=#send-mail',
      reasoning: 'Dispatch the mock email into the in-app outbox.',
      waitMs: 1200,
    },
    {
      type: 'read',
      title: 'Verify the sent confirmation',
      detail: 'Read the sent banner and outbox record for the draft just created.',
      reasoning: 'The workflow is complete only after the send confirmation appears.',
      waitMs: 1500,
    },
  ],
  'mock-scrape': [
    {
      type: 'read',
      title: 'Inspect the bookstore landing page',
      detail: 'Read the category list, visible book cards, and pagination summary on Books to Scrape.',
      reasoning: 'Start by confirming the real catalogue page loaded before narrowing the scrape target.',
      waitMs: 1200,
    },
    {
      type: 'click',
      title: 'Open the Poetry category',
      detail: 'target=a[href="catalogue/category/books/poetry_23/index.html"]',
      reasoning: 'Move into a stable category page so the scrape has a clear subset of books to read.',
      waitMs: 1000,
    },
    {
      type: 'read',
      title: 'Read the Poetry catalogue',
      detail: 'Capture the visible poetry book titles, prices, stock badges, and result count.',
      reasoning: 'The category page provides a cleaner list of structured records to extract.',
      waitMs: 1200,
    },
    {
      type: 'click',
      title: 'Open the first visible book',
      detail: 'target="article.product_pod h3 a"',
      reasoning: 'Drill into a concrete item so the agent can read richer metadata from a real detail page.',
      waitMs: 1000,
    },
    {
      type: 'read',
      title: 'Extract book detail fields',
      detail: 'Read the book title, price, availability, UPC, and product description from the detail page.',
      reasoning: 'A final detail-page read demonstrates the scrape against a real public website.',
      waitMs: 1500,
    },
  ],
}

export function isMockWorkflowName(value: string | null | undefined): value is MockWorkflowName {
  return value === 'mock-form' || value === 'mock-email' || value === 'mock-scrape'
}

export function getMockWorkflowStepCount(workflow: MockWorkflowName): number {
  return WORKFLOWS[workflow].length
}

export function getMaxMockWorkflowStepCount(): number {
  return Math.max(...Object.values(WORKFLOWS).map((steps) => steps.length))
}

function getMockWorkflowPath(workflow: MockWorkflowName): string {
  if (workflow === 'mock-email') {
    return '/mock-email'
  }

  if (workflow === 'mock-scrape') {
    return '/'
  }

  return '/mock-form'
}

function getObservedPath(observation: string | null): string | null {
  const rawUrl = /^URL:\s+(\S+)/im.exec(observation ?? '')?.[1]
  if (!rawUrl) {
    return null
  }

  try {
    return new URL(rawUrl).pathname
  } catch {
    return null
  }
}

function resolveMockWorkflowFromTask(
  defaultWorkflow: MockWorkflowName,
  task: string
): MockWorkflowName {
  const normalizedTask = task.trim().toLowerCase()

  if (!normalizedTask) {
    return defaultWorkflow
  }

  if (
    normalizedTask.includes('mock-form') ||
    normalizedTask.includes('lead intake') ||
    normalizedTask.includes('intake form')
  ) {
    return 'mock-form'
  }

  if (
    normalizedTask.includes('mock-email') ||
    normalizedTask.includes('email workflow') ||
    normalizedTask.includes('compose email') ||
    normalizedTask.includes('send email')
  ) {
    return 'mock-email'
  }

  if (
    normalizedTask.includes('mock-scrape') ||
    normalizedTask.includes('scrape workflow') ||
    normalizedTask.includes('dataset scrape') ||
    normalizedTask.includes('extract rows') ||
    normalizedTask.includes('books to scrape') ||
    normalizedTask.includes('book catalogue') ||
    normalizedTask.includes('poetry category')
  ) {
    return 'mock-scrape'
  }

  return defaultWorkflow
}

export async function planMockWorkflowDecision(
  workflow: MockWorkflowName,
  input: WorkflowPlannerInput
): Promise<AgentDecision> {
  const effectiveWorkflow = resolveMockWorkflowFromTask(workflow, input.task)
  const expectedPath = getMockWorkflowPath(effectiveWorkflow)
  const observedPath = getObservedPath(input.observation)

  if (
    input.step < 0 &&
    (
      (observedPath && observedPath !== expectedPath)
      || (!observedPath && effectiveWorkflow !== workflow)
    )
  ) {
    return {
      type: 'navigate',
      title: `Open ${effectiveWorkflow} workspace`,
      detail: `target=${expectedPath}`,
      reasoning: 'The redirected task points at a different mock workspace, so navigate there before continuing the workflow.',
      waitMs: 1200,
    }
  }

  const steps = WORKFLOWS[effectiveWorkflow]
  const workflowStep = Math.max(input.step, 0)
  return steps[Math.min(workflowStep, steps.length - 1)] ?? {
    type: 'read',
    title: 'Observe final page state',
    detail: 'Read the page after the scripted workflow has finished.',
    reasoning: 'Once all scripted steps are done, stay in observation mode.',
    waitMs: input.fallbackWaitMs,
  }
}
