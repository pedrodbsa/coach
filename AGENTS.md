# Remote Coach — build repo

This repository is a **greenfield build of the Remote Coach v1 system**: a hosted coaching
engine reachable from Telegram and a web browser, driven by a deterministic, tested `coach`
CLI, so the athlete never sits at a desktop to read the day's plan, log, or steer the coaching
rules.

Nothing has been implemented yet. This repo currently holds only the design of record, the
brainstorm material behind it, and the raw content to be ported. The first coding session
starts at **Chunk 1** of the plan.

## Source of truth — read these first, in this order

1. **The plan** — `docs/superpowers/plans/2026-07-23-remote-coach-v1.md`. Thirteen ordered,
   dependency-gated chunks (0–13) plus a **Global Constraints** section that every chunk
   inherits. This is the build script.
2. **The design spec** — `docs/superpowers/specs/2026-07-23-remote-coach-v1-design.md`. The
   source of record for *why*; the plan cites its sections (§2–§15).

The plan and that spec are self-sufficient for the implementer. The `.scratch/coach-remote/`
tree (map, 17 issues, prototypes, research) is the **brainstorm working material** the spec was
synthesised from — historical background, not authority. The plan cites two prototypes by path:
`.scratch/coach-remote/prototypes/2026-07-22.plan.yaml` (the plan-schema reference) and
`.scratch/coach-remote/prototypes/ui-today.html` (the Today-view reference). Where the map and
the spec disagree, **the spec wins**.

## How to start the build

The plan's header prescribes the execution method: implement it **chunk-by-chunk with a review
checkpoint between chunks**, using the `superpowers:executing-plans` skill (or
`superpowers:subagent-driven-development` if driving it within one session). Do not start a
chunk until its dependencies are green. The deterministic engine parts (schema, validators,
brief, lookups, drift-control arithmetic) are built **test-first** per `superpowers:test-driven-development`.

**Begin at Chunk 1** — repo skeleton, TypeScript toolchain, the `coach` CLI entrypoint, and the
structured-JSON output envelope. Chunk 0 is a manual prerequisites gate the athlete owns (see
below); it blocks *deployment* (Chunks 10–13), not the engine work (Chunks 1–9), so the build
starts without it.

Do **not** treat the layout in this file as pre-built. Chunk 1 produces the two-tree layout
(shared logic + `data/<profile>/`); create it there, test-first, rather than assuming it exists.

## The load-bearing invariants (full list in the plan's Global Constraints)

These are inherited by every chunk. The four that shape everything:

- **Profile isolation is a hard invariant.** Every core operation takes a profile and scopes
  strictly to `data/<profile>/`; it must never cross. This is the one code-enforced data boundary.
- **The CLI is the only writer of coaching content.** Specialists (agents) emit **JSON**; the
  CLI validates and persists **YAML**. The agent never hand-edits the plan file.
- **Missing ≠ zero.** A missing value is `null` **plus a first-class gap** `{ field, reason,
  action }`. Output is structured JSON on stdout, always.
- **Path-disjoint write authority.** The server writes only `data/<profile>/`; the builder
  (terminal) writes only logic paths. Effective policy = shipped defaults + per-profile overrides.

## Content to port

`content-source/` holds the current `routine` repo's `protocols/*.md` (11 files) and `logbook/`
(7 months) verbatim. It is **raw material, not the live tree**. Chunk 1 splits it into the four
data kinds — some files split by section, `strength-exercises.md` splits by column, `training.md`
dissolves into head-coach policy (spec §5). Once ported into shared `policy/` + `data/pedro/`,
delete `content-source/`. See `content-source/README.md`.

## Security — do this before any remote exists

The Garmin credentials must **never** be committed. In the old repo the password was checked
into `.mcp.json` in plaintext; **that password must be rotated** (it is already burned into the
old repo's git history) and then supplied only via environment variables here.

- `.mcp.json.example` is the Garmin MCP template — it references `${GARMIN_EMAIL}` /
  `${GARMIN_PASSWORD}`, never a literal. Copy it to `.mcp.json` (gitignored) locally.
- Copy `.env.example` to `.env` (gitignored) and fill in the rotated secrets.
- The one-time `garmin-cli` terminal login writes a mode-0600 token JSON; keep it out of git
  (`secrets/` and `*.token.json` are ignored).

## Git in this repo

This is a new, remote-less repository. `git init` has been run; **no commit has been made** —
the initial commit is the athlete's to make after review. There is no remote yet (Chunk 0
provisions a private one). Never commit `.env`, `.mcp.json`, the Garmin token, or the DuckDB
working files.
