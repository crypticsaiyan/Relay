import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { setLocalRelayShareToken } from '../../../app/lib/local-relay-store.server'

export const Route = createFileRoute('/api/local-relay-share')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()

        const result = await setLocalRelayShareToken(body as {
          sessionId: string
          shareToken: string | null
        })

        return json(result)
      },
    },
  },
})
