import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { issueLocalRelayControlRecord } from '../../../app/lib/local-relay-store.server'

export const Route = createFileRoute('/api/local-relay-control')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()

        const result = await issueLocalRelayControlRecord(body as {
          sessionId: string
          command: 'pause' | 'resume' | 'stop' | 'redirect'
          payload?: string | null
          issuedBy: string
        })

        return json(result)
      },
    },
  },
})
