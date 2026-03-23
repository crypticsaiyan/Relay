# Relay Submission Checklist

Use this file to finalize submission assets for the PowerSync AI Hackathon.

## Required Metadata

- Project name: Relay
- Team: TODO
- Repository: TODO
- Deployed URL: TODO
- Demo video URL: TODO

## Deployment Notes

- Current workspace includes all app/runtime code paths.
- Deploy web app from `apps/web` using your preferred Vite-compatible host.
- Ensure environment variables are configured for production:
  - `POWERSYNC_URL`
  - `POWERSYNC_PRIVATE_KEY`
  - `GEMINI_API_KEY`
  - any auth/provider variables required by your final setup

## Demo Asset Checklist

Capture the following screenshots or clips:

1. Live feed route (`/`) with active action stream and screenshot panel.
2. Control command issuance and executed status transition.
3. Timeline route (`/timeline`) with scrubber and replay selection.
4. Handoff route (`/handoff`) showing generated summary and resume command action.
5. Demo route (`/demo`) showing offline mode banner and queued writes.
6. Demo route reconnect moment showing replay signal/status.

## Technical Proof Checklist

- `pnpm typecheck` passes.
- `pnpm --filter @relay/relay-sdk verify-control-loop` passes.
- Relay SDK dry run command launches and exits cleanly.
- Web app routes load in desktop and mobile viewport.
- Theme toggle works in light/dark/auto.

## Pitch Notes (Sponsor Alignment)

- PowerSync: local-first sync backbone and command propagation.
- Neon: durable event/history model.
- Gemini: model-driven decision loop.
- Ollama: local drift-check narrative.
- TanStack: route-driven UX with responsive pages.

## Final Pre-Submit Pass

1. Fill all TODO fields above.
2. Verify deployed URL works without local dependencies.
3. Verify all screenshots/video links are public.
4. Re-read README for consistency with deployed behavior.
