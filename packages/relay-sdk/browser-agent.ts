import type { Locator, Page } from 'playwright'
import type { RelayStructuredDataPayload } from '@relay/shared'
import type { AgentDecision, DecisionExecutionResult } from './sample-agent'

type BrowserMemory = {
  recentActions: string[]
  recentObservations: string[]
}

type PlaywrightDecisionExecutorOptions = {
  page: Page
  initialUrl: string
  captureScreenshot?: () => Promise<string | null>
  task: string
  memory: BrowserMemory
  sameOriginOnly?: boolean
}

const DANGEROUS_KEYWORDS = [
  'delete',
  'remove',
  'logout',
  'sign out',
  'pay',
  'purchase',
  'buy now',
  'confirm order',
  'submit payment',
  'place order',
]

export function createBrowserMemory(): BrowserMemory {
  return {
    recentActions: [],
    recentObservations: [],
  }
}

export function createPlaywrightDecisionExecutor(
  options: PlaywrightDecisionExecutorOptions
): (decision: AgentDecision) => Promise<DecisionExecutionResult> {
  return async (decision) => {
    const result = await executeDecision(options, decision)
    const postActionObservation = await observePage(options.page, options.memory).catch(() => null)
    if (postActionObservation) {
      pushRecent(options.memory.recentObservations, postActionObservation)
    }

    const screenshotB64 = options.captureScreenshot
      ? await options.captureScreenshot().catch(() => null)
      : null

    const mergedDetailSuffix = joinLines(
      result.detailSuffix,
      postActionObservation ? `Post-action page:\n${postActionObservation}` : null
    )

    return {
      ...result,
      ...(mergedDetailSuffix ? { detailSuffix: mergedDetailSuffix } : {}),
      ...(screenshotB64 ? { screenshotB64 } : { screenshotB64: null }),
    }
  }
}

export async function observePage(page: Page, memory?: BrowserMemory): Promise<string> {
  const observation = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]'))
      .filter((element) => {
        const html = element as HTMLElement
        const style = window.getComputedStyle(html)
        const rect = html.getBoundingClientRect()
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
      })
      .map((element) => (((element as HTMLInputElement).value || element.textContent) ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 6)

    const links = Array.from(document.querySelectorAll('a[href]'))
      .filter((element) => {
        const html = element as HTMLElement
        const style = window.getComputedStyle(html)
        const rect = html.getBoundingClientRect()
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
      })
      .map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 6)

    const inputs = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
      .filter((element) => {
        const html = element as HTMLElement
        const style = window.getComputedStyle(html)
        const rect = html.getBoundingClientRect()
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
      })
      .map((element) => {
        const input = element as HTMLInputElement | HTMLTextAreaElement
        return (
          input.getAttribute('placeholder')
          || input.getAttribute('aria-label')
          || input.getAttribute('name')
          || input.id
          || input.type
          || ''
        ).replace(/\s+/g, ' ').trim()
      })
      .filter(Boolean)
      .slice(0, 6)

    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .filter((element) => {
        const html = element as HTMLElement
        const style = window.getComputedStyle(html)
        const rect = html.getBoundingClientRect()
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
      })
      .map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 4)

    return {
      url: window.location.href,
      title: document.title,
      headings,
      buttons,
      links,
      inputs,
    }
  })

  const observationLines = [
    `URL: ${observation.url}`,
    `Title: ${observation.title || 'Untitled page'}`,
    `Headings: ${observation.headings.join(' | ') || 'none'}`,
    `Buttons: ${observation.buttons.join(' | ') || 'none'}`,
    `Links: ${observation.links.join(' | ') || 'none'}`,
    `Inputs: ${observation.inputs.join(' | ') || 'none'}`,
  ]

  if (memory && memory.recentActions.length > 0) {
    observationLines.push(`Recent actions: ${memory.recentActions.join(' | ')}`)
  }

  return observationLines.join('\n')
}

async function executeDecision(
  options: PlaywrightDecisionExecutorOptions,
  decision: AgentDecision
): Promise<DecisionExecutionResult> {
  switch (decision.type) {
    case 'navigate':
      return executeNavigate(options, decision)
    case 'click':
      return executeClick(options, decision)
    case 'type':
      return executeType(options, decision)
    case 'read':
      return executeRead(options)
    case 'wait':
      await options.page.waitForTimeout(800)
      return {
        detailSuffix: `Observed ${options.page.url()} while waiting.`,
        reasoningSuffix: 'Wait completed in the live browser session.',
      }
    case 'decide':
      return executeRead(options)
    default:
      return {
        detailSuffix: `Unsupported browser action type: ${decision.type}`,
        reasoningSuffix: 'No browser-side execution was performed for this action type.',
      }
  }
}

async function executeNavigate(
  options: PlaywrightDecisionExecutorOptions,
  decision: AgentDecision
): Promise<DecisionExecutionResult> {
  const candidateUrl = resolveNavigationTarget(decision, options)
  if (!isAllowedUrl(candidateUrl, options)) {
    return {
      detailSuffix: `Blocked navigation to ${candidateUrl}. Same-origin mode is active.`,
      reasoningSuffix: 'Navigation was prevented by the safer multi-step browsing policy.',
    }
  }

  const beforeUrl = options.page.url()
  if (candidateUrl !== beforeUrl) {
    await options.page.goto(candidateUrl, { waitUntil: 'domcontentloaded' })
  } else {
    await options.page.reload({ waitUntil: 'domcontentloaded' })
  }

  const summary = `navigate -> ${options.page.url()}`
  pushRecent(options.memory.recentActions, summary)

  return {
    detailSuffix: `Navigated to ${options.page.url()}.`,
    reasoningSuffix: 'The agent used Playwright navigation against a real webpage.',
  }
}

function resolveNavigationTarget(
  decision: AgentDecision,
  options: PlaywrightDecisionExecutorOptions
): string {
  const explicitTarget =
    extractInstructionField('target', decision.detail)
    ?? extractInstructionField('target', decision.title)

  if (explicitTarget) {
    if (/^https?:\/\//i.test(explicitTarget)) {
      return explicitTarget
    }

    return new URL(explicitTarget, options.page.url() || options.initialUrl).toString()
  }

  return extractUrl(decision.detail) ?? extractUrl(decision.title) ?? options.initialUrl
}

async function executeClick(
  options: PlaywrightDecisionExecutorOptions,
  decision: AgentDecision
): Promise<DecisionExecutionResult> {
  const targetSelector = extractInstructionField('target', decision.detail) ?? extractInstructionField('target', decision.title)
  if (targetSelector) {
    const explicitTarget = options.page.locator(targetSelector).first()
    if (await explicitTarget.isVisible().catch(() => false)) {
      const label = await getLocatorLabel(explicitTarget)
      if (isDangerousLabel(label)) {
        return {
          detailSuffix: `Blocked click on "${label}" due to safety policy.`,
          reasoningSuffix: 'Potentially destructive or irreversible controls are blocked by default.',
        }
      }

      await explicitTarget.click({ timeout: 5000 })
      await options.page.waitForLoadState('domcontentloaded').catch(() => {})
      pushRecent(options.memory.recentActions, `click -> ${label}`)

      return {
        detailSuffix: `Clicked "${label}" using selector ${targetSelector} on ${options.page.url()}.`,
        reasoningSuffix: 'The agent executed a targeted real click in Playwright.',
      }
    }
  }

  const keywords = extractKeywords(`${decision.title} ${decision.detail} ${options.task}`)
  const target = await findClickableTarget(options.page, keywords)
  if (!target) {
    return {
      detailSuffix: 'No clickable button or link was found on the live page.',
      reasoningSuffix: 'The browser executor could not match any visible clickable target.',
    }
  }

  const label = await getLocatorLabel(target)
  if (isDangerousLabel(label)) {
    return {
      detailSuffix: `Blocked click on "${label}" due to safety policy.`,
      reasoningSuffix: 'Potentially destructive or irreversible controls are blocked by default.',
    }
  }

  await target.click({ timeout: 5000 })
  await options.page.waitForLoadState('domcontentloaded').catch(() => {})
  pushRecent(options.memory.recentActions, `click -> ${label}`)

  return {
    detailSuffix: `Clicked "${label}" on ${options.page.url()}.`,
    reasoningSuffix: 'The agent executed a real click in Playwright and then waited for the page to settle.',
  }
}

async function executeType(
  options: PlaywrightDecisionExecutorOptions,
  decision: AgentDecision
): Promise<DecisionExecutionResult> {
  const targetSelector = extractInstructionField('target', decision.detail) ?? extractInstructionField('target', decision.title)
  let target: Locator | null = null
  if (targetSelector) {
    const explicitTarget = options.page.locator(targetSelector).first()
    if (await explicitTarget.isVisible().catch(() => false)) {
      target = explicitTarget
    }
  }

  if (!target) {
    target = await findInputTarget(options.page)
  }

  if (!target) {
    return {
      detailSuffix: 'No visible text input or textarea was found on the live page.',
      reasoningSuffix: 'The browser executor could not find anywhere to type.',
    }
  }

  const label = await getLocatorLabel(target)
  if (await isSensitiveInput(target, label)) {
    return {
      detailSuffix: `Blocked typing into "${label}" because it looks sensitive.`,
      reasoningSuffix: 'Password, payment, and similar fields are blocked by default.',
    }
  }

  const value = extractInstructionField('value', decision.detail) ?? buildInputValue(options.task, decision)
  await target.fill(value, { timeout: 5000 })
  await options.page.waitForLoadState('domcontentloaded').catch(() => {})
  pushRecent(options.memory.recentActions, `type -> ${label}`)

  return {
    detailSuffix: `Typed "${value}" into "${label}" on ${options.page.url()}.`,
    reasoningSuffix: 'The agent filled a real input field in Playwright.',
  }
}

async function executeRead(options: PlaywrightDecisionExecutorOptions): Promise<DecisionExecutionResult> {
  const observation = await observePage(options.page, options.memory)
  const structuredData = await extractStructuredScrapeData(options.page)
  const detailSuffix = joinLines(
    observation,
    formatStructuredScrapeSummary(structuredData)
  )
  pushRecent(options.memory.recentActions, `read -> ${options.page.url()}`)
  return {
    ...(detailSuffix ? { detailSuffix } : {}),
    reasoningSuffix: structuredData
      ? 'The agent read the live DOM, extracted structured scrape data, and summarized the visible page state.'
      : 'The agent read the live DOM and summarized the visible page state.',
    structuredData,
  }
}

async function extractStructuredScrapeData(
  page: Page
): Promise<RelayStructuredDataPayload | null> {
  return page.evaluate(() => {
    if (window.location.hostname !== 'books.toscrape.com') {
      return null
    }

    const bookCards = Array.from(document.querySelectorAll('article.product_pod'))
      .map((card) => {
        const anchor = card.querySelector('h3 a')
        const title =
          String(anchor?.getAttribute('title') ?? '')
            .replace(/\s+/g, ' ')
            .trim()
          || String(anchor?.textContent ?? '')
            .replace(/\s+/g, ' ')
            .trim()
        const price = String(card.querySelector('.price_color')?.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim()
        const availability = String(card.querySelector('.instock.availability')?.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim()

        if (!title) {
          return null
        }

        return {
          title,
          price: price || null,
          availability: availability || null,
        }
      })
      .filter(Boolean) as Array<{
        title: string
        price: string | null
        availability: string | null
      }>

    if (bookCards.length > 0) {
      const category = String(
        document.querySelector('.breadcrumb li.active')?.textContent ?? ''
      )
        .replace(/\s+/g, ' ')
        .trim()
      return {
        kind: 'books-list' as const,
        source: 'books.toscrape.com' as const,
        url: window.location.href,
        pageTitle: document.title,
        category: category || null,
        resultCount: bookCards.length,
        books: bookCards,
      }
    }

    const detailTitle = String(
      document.querySelector('.product_main h1')?.textContent ?? ''
    )
      .replace(/\s+/g, ' ')
      .trim()
    if (!detailTitle) {
      return null
    }

    const price = String(
      document.querySelector('.product_main .price_color')?.textContent ?? ''
    )
      .replace(/\s+/g, ' ')
      .trim()
    const availability = String(
      document.querySelector('.product_main .availability')?.textContent ?? ''
    )
      .replace(/\s+/g, ' ')
      .trim()
    const description = String(
      document.querySelector('#product_description + p')?.textContent ?? ''
    )
      .replace(/\s+/g, ' ')
      .trim()
    const rows = Array.from(document.querySelectorAll('table.table.table-striped tr'))
    const upcRow = rows.find((row) => {
      const heading = String(row.querySelector('th')?.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim()
      return heading === 'UPC'
    })
    const upc = String(upcRow?.querySelector('td')?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()

    return {
      kind: 'book-detail' as const,
      source: 'books.toscrape.com' as const,
      url: window.location.href,
      pageTitle: document.title,
      title: detailTitle,
      price: price || null,
      availability: availability || null,
      upc: upc || null,
      description: description || null,
    }
  })
}

function formatStructuredScrapeSummary(
  payload: RelayStructuredDataPayload | null
): string | null {
  if (!payload) {
    return null
  }

  if (payload.kind === 'books-list') {
    const previewRows = payload.books
      .slice(0, 5)
      .map((book) => `${book.title} | ${book.price ?? 'n/a'} | ${book.availability ?? 'n/a'}`)
      .join('\n')

    return joinLines(
      `Structured scrape result: ${payload.resultCount} visible books captured from ${payload.category ?? 'catalogue'}.`,
      previewRows ? `Preview rows:\n${previewRows}` : null
    ) ?? null
  }

  return joinLines(
    `Structured scrape result: captured detail record for "${payload.title}".`,
    `Price: ${payload.price ?? 'n/a'}`,
    `Availability: ${payload.availability ?? 'n/a'}`,
    `UPC: ${payload.upc ?? 'n/a'}`
  ) ?? null
}

async function findClickableTarget(page: Page, keywords: string[]): Promise<Locator | null> {
  for (const keyword of keywords) {
    const button = await firstVisibleLocator(page.getByRole('button', { name: new RegExp(escapeRegex(keyword), 'i') }))
    if (button) {
      return button
    }

    const link = await firstVisibleLocator(page.getByRole('link', { name: new RegExp(escapeRegex(keyword), 'i') }))
    if (link) {
      return link
    }
  }

  const fallback = await firstVisibleLocator(
    page.locator('button, [role="button"], a[href], input[type="submit"], input[type="button"]')
  )

  if (!fallback) {
    return null
  }

  const label = await getLocatorLabel(fallback)
  return isDangerousLabel(label) ? null : fallback
}

async function findInputTarget(page: Page): Promise<Locator | null> {
  return firstVisibleLocator(
    page.locator('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]')
  )
}

async function firstVisibleLocator(locator: Locator): Promise<Locator | null> {
  const count = Math.min(await locator.count(), 8)
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index)
    if (await candidate.isVisible().catch(() => false)) {
      return candidate
    }
  }

  return null
}

async function getLocatorLabel(locator: Locator): Promise<string> {
  return (
    (await locator
      .evaluate((element) => {
        const input = element as HTMLInputElement | HTMLTextAreaElement
        return (
          input.value
          || input.getAttribute('aria-label')
          || input.getAttribute('placeholder')
          || input.getAttribute('name')
          || input.id
          || element.textContent
          || element.nodeName
        )
      })
      .catch(() => null))
      ?.replace(/\s+/g, ' ')
      .trim()
      || 'unnamed element'
  )
}

async function isSensitiveInput(locator: Locator, label: string): Promise<boolean> {
  const meta = await locator
    .evaluate((element) => {
      const input = element as HTMLInputElement | HTMLTextAreaElement
      return [
        input.getAttribute('type') ?? '',
        input.getAttribute('name') ?? '',
        input.getAttribute('autocomplete') ?? '',
        input.getAttribute('id') ?? '',
      ].join(' ')
    })
    .catch(() => '')

  const value = `${label} ${meta}`.toLowerCase()
  return ['password', 'card', 'credit', 'cvv', 'otp', 'security code'].some((token) => value.includes(token))
}

function buildInputValue(task: string, decision: AgentDecision): string {
  const quoted = /"([^"]+)"/.exec(`${decision.detail} ${decision.title}`)?.[1]
  if (quoted) {
    return quoted
  }

  return task.replace(/\s+/g, ' ').trim().slice(0, 80) || 'relay demo'
}

function extractKeywords(value: string): string[] {
  const stopwords = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'onto', 'your', 'task',
    'click', 'type', 'read', 'page', 'visible', 'next', 'real', 'agent', 'most', 'relevant',
  ])

  const seen = new Set<string>()
  const keywords: string[] = []

  for (const part of value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []) {
    if (stopwords.has(part) || seen.has(part)) {
      continue
    }

    seen.add(part)
    keywords.push(part)
  }

  return keywords.slice(0, 6)
}

function extractUrl(value: string): string | null {
  const match = value.match(/https?:\/\/[^\s)]+/i)
  return match?.[0] ?? null
}

function extractInstructionField(field: string, value: string): string | null {
  const quoted = new RegExp(`${field}="([^"]+)"`).exec(value)
  if (quoted?.[1]) {
    return quoted[1]
  }

  const plain = new RegExp(`${field}=([^\\s]+)`).exec(value)
  return plain?.[1] ?? null
}

function isAllowedUrl(url: string, options: PlaywrightDecisionExecutorOptions): boolean {
  if (options.sameOriginOnly === false) {
    return true
  }

  return new URL(url).origin === new URL(options.initialUrl).origin
}

function isDangerousLabel(value: string): boolean {
  const lowered = value.toLowerCase()
  return DANGEROUS_KEYWORDS.some((keyword) => lowered.includes(keyword))
}

function pushRecent(list: string[], value: string): void {
  list.unshift(value)
  if (list.length > 4) {
    list.length = 4
  }
}

function joinLines(...values: Array<string | null | undefined>): string | undefined {
  const filtered = values.filter((value): value is string => Boolean(value?.trim()))
  return filtered.length > 0 ? filtered.join('\n') : undefined
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
