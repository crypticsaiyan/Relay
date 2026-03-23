import { createFileRoute } from '@tanstack/react-router'
import DemoPage from '../../app/routes/demo'

export const Route = createFileRoute('/demo')({ component: DemoPage })
