import { chromium, type Browser, type Page } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'

export type ScreenshotLoopOptions = {
  intervalMs: number
  onScreenshot: (base64Jpeg: string) => Promise<void>
  capture: () => Promise<string | null>
}

export async function capturePageScreenshotBase64(page: Page, quality = 35): Promise<string> {
  const buffer = await page.screenshot({
    type: 'jpeg',
    quality,
    fullPage: true,
  })

  return buffer.toString('base64')
}

export async function startPlaywrightCapture(
  url: string,
  input: {
    headless?: boolean
  } = {}
): Promise<{
  browser: Browser
  page: Page
}> {
  let browser: Browser
  try {
    browser = await chromium.launch({ headless: input.headless ?? true })
  } catch (error) {
    if (input.headless === false) {
      console.warn(`Visible browser launch failed. Retrying headless mode. ${String(error)}`)
      browser = await chromium.launch({ headless: true })
    } else {
      throw error
    }
  }

  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded' })

  return { browser, page }
}

export function startScreenshotLoop(options: ScreenshotLoopOptions): () => void {
  let running = true

  const loop = async () => {
    while (running) {
      try {
        const screenshot = await options.capture()
        if (screenshot) {
          await options.onScreenshot(screenshot)
        }
      } catch (error) {
        console.warn('Screenshot capture failed:', error)
      }

      await sleep(options.intervalMs)
    }
  }

  void loop()

  return () => {
    running = false
  }
}
