import json
import os
import time
import urllib.request

BASE_URL = os.environ.get("RELAY_BRIDGE_URL", "http://127.0.0.1:8787")
task = os.environ.get(
    "RELAY_TASK",
    "Review the newest support tickets, flag urgent cases, and draft a summary.",
)

steps = [
    {
        "type": "navigate",
        "title": "Opened support inbox",
        "detail": "Loaded the newest tickets for triage.",
    },
    {
        "type": "read",
        "title": "Read urgent tickets",
        "detail": "Grouped refunds, shipping issues, and escalation requests.",
    },
    {
        "type": "decide",
        "title": "Prepared response plan",
        "detail": "Compiled the next work queue for the operator.",
    },
]


def request(path, payload=None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST" if payload is not None else "GET",
    )

    with urllib.request.urlopen(req) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else None


request("/health")
request("/session/status", {"status": "running"})

for step in steps:
    control = request("/control?consumeRedirect=true")

    if control["redirectInstruction"]:
        task = control["redirectInstruction"]
        request(
            "/action",
            {
                "type": "redirect",
                "title": "Redirect received from Relay",
                "detail": task,
                "reasoning": "Switching to the new operator-provided objective.",
            },
        )

    while control["paused"] and not control["stopRequested"]:
        request("/session/status", {"status": "paused"})
        print("Relay paused the agent. Waiting for resume...")
        time.sleep(1.0)
        control = request("/control?consumeRedirect=true")

    if control["stopRequested"]:
        print("Relay requested stop. Exiting.")
        request("/session/status", {"status": "stopped"})
        raise SystemExit(0)

    request("/session/status", {"status": "running"})
    request(
        "/action",
        {
            **step,
            "reasoning": f"Current task: {task}",
        },
    )
    time.sleep(1.2)

request("/session/status", {"status": "completed"})
print("Demo agent finished successfully.")
