# Remote Coach

A hosted coaching system reachable from Telegram and a web browser, driven by a deterministic,
tested `coach` CLI, so the athlete never sits at a desktop to read the day's plan, log a meal or
session, or steer the coaching rules over time.

> **Status: pre-implementation.** This repository currently contains the design of record and
> the raw content to be ported. No engine code exists yet. The build starts at Chunk 1 of the
> implementation plan.

## Where things are

| Path | What it is |
| --- | --- |
| `docs/superpowers/plans/2026-07-23-remote-coach-v1.md` | The implementation plan — 13 ordered chunks + Global Constraints. **The build script.** |
| `docs/superpowers/specs/2026-07-23-remote-coach-v1-design.md` | The design spec — the source of record for *why*. |
| `docs/superpowers/specs/archive/` | The superseded 2026-06-19 spec, kept for the "What changed" reference. |
| `.scratch/coach-remote/` | Brainstorm working material (map, 17 issues, prototypes, research). Background, not authority. |
| `content-source/` | The current `routine` repo's `protocols/` + `logbook/`, verbatim — raw material to port, then delete. |
| `AGENTS.md` | Orientation for an AI coding session. Read it first. |

## Getting started (for a new coding session)

1. Read `AGENTS.md`, then the plan, then the spec.
2. Use the `superpowers:executing-plans` skill and start at **Chunk 1**. Build chunk-by-chunk
   with a review checkpoint between chunks; the deterministic engine parts are test-first.

## Local setup (secrets)

```sh
cp .env.example .env            # fill in the ROTATED Garmin password + Telegram/other secrets
cp .mcp.json.example .mcp.json  # Garmin MCP; reads the password from the environment
```

`.env`, `.mcp.json`, and the Garmin token JSON are gitignored and must never be committed. The
Garmin password that was previously committed in the old repo must be **rotated** before use.

## Architecture, in one breath

Two cleanly-separated layers. **The engine** — a bespoke TypeScript `coach` library exposed as
a single canonical CLI (agent orchestration via the Claude Agent SDK, the plan schema,
validators, lookups, the brief, Garmin writes). **The driver** — n8n: per-profile workflows,
Telegram I/O, cron, the HTTP API for the web app, durable human-in-the-loop gates. Every driver
reaches the engine by *exec'ing the CLI*; nothing imports the library but the CLI. The engine is
proven end-to-end at the terminal (Chunks 1–9) before any driver wraps it (Chunks 10–13).
