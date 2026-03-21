export const RELAY_STRUCTURED_DATA_MARKER = '__relay_structured_data__='

export type RelayBooksToScrapeListItem = {
  title: string
  price: string | null
  availability: string | null
}

export type RelayBooksToScrapeListPayload = {
  kind: 'books-list'
  source: 'books.toscrape.com'
  url: string
  pageTitle: string
  category: string | null
  resultCount: number
  books: RelayBooksToScrapeListItem[]
}

export type RelayBooksToScrapeDetailPayload = {
  kind: 'book-detail'
  source: 'books.toscrape.com'
  url: string
  pageTitle: string
  title: string
  price: string | null
  availability: string | null
  upc: string | null
  description: string | null
}

export type RelayStructuredDataPayload =
  | RelayBooksToScrapeListPayload
  | RelayBooksToScrapeDetailPayload

export function appendRelayStructuredData(
  detail: string,
  payload: RelayStructuredDataPayload | null | undefined
): string {
  const trimmedDetail = detail.trim()
  if (!payload) {
    return trimmedDetail
  }

  const serializedPayload = `${RELAY_STRUCTURED_DATA_MARKER}${JSON.stringify(payload)}`
  return trimmedDetail ? `${trimmedDetail}\n\n${serializedPayload}` : serializedPayload
}

export function parseRelayStructuredData(detail: string | null | undefined): {
  detail: string
  structuredData: RelayStructuredDataPayload | null
} {
  const rawDetail = detail ?? ''
  const markerIndex = rawDetail.lastIndexOf(RELAY_STRUCTURED_DATA_MARKER)
  if (markerIndex < 0) {
    return {
      detail: rawDetail.trim(),
      structuredData: null,
    }
  }

  const visibleDetail = rawDetail.slice(0, markerIndex).trim()
  const serializedPayload = rawDetail
    .slice(markerIndex + RELAY_STRUCTURED_DATA_MARKER.length)
    .trim()

  if (!serializedPayload) {
    return {
      detail: visibleDetail,
      structuredData: null,
    }
  }

  try {
    const parsedPayload = JSON.parse(serializedPayload) as RelayStructuredDataPayload
    return {
      detail: visibleDetail,
      structuredData: parsedPayload,
    }
  } catch {
    return {
      detail: rawDetail.trim(),
      structuredData: null,
    }
  }
}
