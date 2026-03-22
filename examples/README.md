# Relay External Agent Examples

These examples show the smallest agent loops that can report into Relay through bridge mode.

## Start Relay first

```bash
pnpm --filter @relay/relay-sdk relay-watch \
  --name "Support Triage Agent" \
  --agent-id support-triage-agent \
  --task "Review the newest support tickets, flag urgent cases, and draft a summary." \
  --user-id demo_user \
  --bridge true \
  --bridge-port 8787
```

## JavaScript example

```bash
node examples/external-agent-js/agent.mjs
```

## Python example

```bash
python3 examples/external-agent-python/agent.py
```

Override the bridge URL or task with `RELAY_BRIDGE_URL` and `RELAY_TASK`.
