# Relay Architecture Context

This file is a durable context handoff for engineers working in different IDEs.

## Product Summary
Relay is a live observation and control platform for AI agents. A local machine runs an agent with Relay SDK instrumentation. Browsers connected to the same session can watch actions in real time and send control commands (pause, resume, redirect, stop).

## Delivery Status
- Complete in this workspace:
	- Monorepo foundation and strict TypeScript setup.
	- Neon schema, PowerSync mirror schema, and sync rules scaffolding.
	- Relay SDK runtime with command listener, screenshot support, drift checks, and Gemini decision loop.
	- Web UI routes: live feed, timeline replay, handoff, and demo mode.
	- Offline/online queue demonstration and control loop verification script.

## Three-Part Architecture
1. Local script (`packages/relay-sdk`): wraps agent loop, logs action/reasoning/screenshot, listens for control commands.
2. PowerSync sync layer: bidirectional sync between local SQLite, Neon, and browser local SQLite.
3. Web app (`apps/web`): renders live feed and writes control commands to local browser SQLite.

## Critical Control Loop (Judge-Facing)
1. Browser writes pause/redirect/stop to local SQLite.
2. PowerSync uploads command.
3. PowerSync syncs command down to machine SQLite.
4. Local script executes command and marks `executed_at`.
5. Browser receives executed status via sync.

This loop is the core technical demonstration and must remain explicit in code comments and demos.

## Demo Narrative
1. Start `relay-watch` to open a local session.
2. Observe actions, reasoning, and screenshots on the live feed.
3. Send pause, redirect, and stop from the browser.
4. Switch to timeline replay to scrub historical steps.
5. Generate handoff summary and resume with context.
6. Run demo mode and toggle offline to show local queue behavior and replay signal on reconnect.

## Sponsor Mapping
- PowerSync: core synchronization architecture.
- Neon: permanent append-only event and command store.
- Mastra: intent drift detection workflow.
- TanStack: Start framework + DB reactive local queries.
- Supabase: authentication and watcher identity.
- Local-First prize: local SQLite first writes + Ollama local inference.
