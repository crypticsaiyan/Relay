import { createFileRoute } from '@tanstack/react-router'
import LiveFeedPage from '../../app/routes/index'

export const Route = createFileRoute('/live')({
  component: LiveFeedPage,
  head: () => ({
    meta: [
      {
        title: 'Relay | Live Feed',
      },
    ],
  }),
})
