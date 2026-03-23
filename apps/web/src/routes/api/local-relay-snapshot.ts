import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  getLocalRelayStoreDebug,
  readLocalRelaySnapshot,
} from '../../../app/lib/local-relay-store.server'

export const Route = createFileRoute('/api/local-relay-snapshot')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const sessionId = url.searchParams.get('sessionId')
        const debug = url.searchParams.get('debug') === '1'

        if (debug) {
          return json({
            debug: await getLocalRelayStoreDebug(),
          })
        }

        const snapshot = await readLocalRelaySnapshot({
          sessionId: sessionId && sessionId.trim().length > 0 ? sessionId : null,
        })

        return json(snapshot)
      },
    },
  },
})
