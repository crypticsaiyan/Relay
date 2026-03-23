export function toScreenshotSrc(screenshot: string): string {
  if (screenshot.startsWith('data:')) {
    return screenshot
  }

  return `data:image/jpeg;base64,${screenshot}`
}

export function buildFallbackScreenshotSrc(input: {
  sessionName?: string | null
  status?: string | null
  title?: string | null
  detail?: string | null
  reasoning?: string | null
}): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">` +
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="#08111f"/>` +
    `<stop offset="100%" stop-color="#1f2937"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="1280" height="720" fill="url(#bg)"/>` +
    `<rect x="52" y="44" width="230" height="54" rx="14" fill="#0f766e"/>` +
    `<text x="167" y="79" fill="#f0fdfa" font-size="24" text-anchor="middle" font-family="Arial, sans-serif">Relay Live</text>` +
    `<text x="52" y="148" fill="#94a3b8" font-size="22" font-family="Arial, sans-serif">Session</text>` +
    `<text x="52" y="194" fill="#f8fafc" font-size="38" font-family="Arial, sans-serif">${escapeXml(input.sessionName ?? 'Live session')}</text>` +
    `<text x="52" y="258" fill="#94a3b8" font-size="22" font-family="Arial, sans-serif">Status</text>` +
    `<text x="52" y="304" fill="#e2e8f0" font-size="30" font-family="Arial, sans-serif">${escapeXml(input.status ?? 'Running')}</text>` +
    `<text x="52" y="378" fill="#94a3b8" font-size="22" font-family="Arial, sans-serif">Latest action</text>` +
    `<text x="52" y="424" fill="#f8fafc" font-size="34" font-family="Arial, sans-serif">${escapeXml(input.title ?? 'Waiting for captured screen')}</text>` +
    `<text x="52" y="486" fill="#cbd5e1" font-size="24" font-family="Arial, sans-serif">${escapeXml(input.detail ?? 'This session has action data but no screenshot frame stored.')}</text>` +
    `<text x="52" y="570" fill="#94a3b8" font-size="22" font-family="Arial, sans-serif">Reasoning</text>` +
    `<text x="52" y="616" fill="#e2e8f0" font-size="24" font-family="Arial, sans-serif">${escapeXml(input.reasoning ?? 'No reasoning available yet.')}</text>` +
    `</svg>`

  return `data:image/svg+xml;base64,${btoa(svg)}`
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
