# Relay Build Phases

This checklist keeps implementation aligned when context switches between IDEs.

## Phase 1: Foundation
Status: complete.
Acceptance:
- pnpm monorepo initialized.
- `apps/web` TanStack Start shell boots.
- `packages/shared/types.ts` includes core Relay contracts.
- `.env.example` present.

## Phase 2: Database and PowerSync
Status: complete.
Acceptance:
- Neon schema and migration runner.
- PowerSync schema + sync rules.
- Token endpoint and typed client watcher wiring.

## Phase 3: Relay SDK
Status: complete.
Acceptance:
- CLI entrypoint.
- action/reasoning logging.
- control listener.
- screenshot loop.
- drift detector.

## Phase 4: Gemini Agent
Status: complete.
Acceptance:
- sample agent loop with screenshot vision.
- integration with Relay SDK logging/control APIs.

## Phase 5: Live Feed Page
Status: complete.
Acceptance:
- full five-zone UI.
- real-time action stream.
- pause/redirect/stop writes from browser local SQLite.

## Phase 6: Control Loop End-to-End
Status: complete.
Acceptance:
- bidirectional pause/resume/redirect works.
- offline queue and replay behavior verified.

## Phase 7: Timeline Page
Status: complete.
Acceptance:
- scrubber + replay for session history.

## Phase 8: Handoff Page
Status: complete.
Acceptance:
- share token access.
- generated summary.
- resume with context.

## Phase 9: Demo Mode
Status: complete.
Acceptance:
- self-running realistic simulation.
- dramatic offline toggle demonstration.

## Phase 10: Polish and Submission
Status: complete in-code; deployment URL remains environment-dependent.
Acceptance:
- responsive UI and dark mode.
- loading/error states.
- complete README with architecture and sponsor fit.
- deployed URL and submission assets.
