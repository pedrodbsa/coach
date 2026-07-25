# Remote Coach — build repo

This repository is a **greenfield build of the Remote Coach v1 system**: a hosted coaching
engine reachable from Telegram and a web browser, driven by a deterministic, tested `coach`
CLI, so the athlete never sits at a desktop to read the day's plan, log, or steer the coaching
rules.

**Chunks 1 and 2 are built and reviewed** (CLI skeleton, output envelope, profile scoper, YAML
codec, the kind-typed storage service, proposals/promotion, plugin registry + stub, and the
2026-07-25 amendment retro-fit). 240 tests green. The live board is `docs/tasks/README.md`, which
records Chunk 2's review verdict, its two accepted deviations and the open items it raised.

## Source of truth — read these first, in this order

1. **The plan** — `docs/superpowers/plans/2026-07-23-remote-coach-v1.md`. Thirteen ordered,
   dependency-gated chunks (0–13) plus a **Global Constraints** section that every chunk
   inherits. This is the build script.
2. **The design spec** — `docs/superpowers/specs/2026-07-23-remote-coach-v1-design.md`. The
   source of record for *why*; the plan cites its sections (§2–§15).
3. **The plugin contract** — `docs/superpowers/specs/2026-07-23-plugin-contract.md`. The plugin
   seam in full: storage kinds and their write rules, registration, the deterministic `summary`,
   when a domain warrants a coach, synergies, petitions, propose→promote.
4. **The coaching-loop amendments** — `docs/superpowers/specs/2026-07-25-coaching-loop-and-identity.md`.
   The head coach becomes a plugin; coach identity is added as *logic*; summary facts gain
   provenance; a windowed `progress` verb joins `summary`; actions gain a completion model. Its
   §8 lists exactly which passages of 1–3 it supersedes.

**Precedence when two of these disagree:** the design spec beats the plan; the plugin contract
refines the design spec only where the spec is silent; the amendments beat all three **for the
areas they name**, and everything else stands. Each document states this in its own header.

The plan and those specs are self-sufficient for the implementer. The `.scratch/coach-remote/`
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

**Next up: Chunk 3** — the plan schema, YAML persistence and the first deterministic command, with
the five schema fields the 2026-07-25 amendments add. Its six task files are written
(`docs/tasks/03-*.md`); **3.0, 3.1 and 3.3 are independent and can run in parallel**. Chunk 0 is a
manual prerequisites gate the athlete owns (see below); it blocks *deployment* (Chunks 10–13), not
the engine work (Chunks 1–9).

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

Four more, added 2026-07-25, that shape the coaching loop rather than the file layout:

- **Nothing reads across a namespace.** Not even the head coach — it is a plugin, and its breadth
  is what a workflow step *hands* it (the brief, petitions, `coach query` as a tool), never a
  wider handle. Cross-domain information is *published*, never read.
- **Missing ≠ zero applies to behaviour too.** Silence is `unknown`, never `skipped`. Unknowns are
  reported beside completions (`4/6 completed, 2 unknown`), never folded into a percentage.
- **Prose is agent-readable, CLI-never.** Nothing a validator checks, a summary computes with, or
  a lookup resolves may live *only* in prose — in a `COACH.md`, a `notes:` field, or anywhere
  else. This is the rule that stops `training.md` regrowing.
- **Domains adjust the *how* freely; they only ever *propose* the rules.** Every durable change
  has a proposer, a rationale, a mediator and the athlete's signature.

## Content to port

`content-source/` holds the current `routine` repo's `protocols/*.md` (11 files) and `logbook/`
(7 months) verbatim. It is **raw material, not the live tree**, and it is still unported — Chunk 1
built the empty two-tree layout, not its contents. The port happens **per domain, with that
domain's chunk**: nutrition in Chunk 5, running and strength in Chunk 6, the head coach in
Chunk 7. Some files split by section, `strength-exercises.md` splits by column, and `training.md`
**dissolves** into head-coach policy (spec §5).

Porting means **restructuring, not copying**: a rule that a validator will check lands as a
threshold in policy YAML, never as a paragraph — the amendments' §2.3 prose rule. Once every
domain's content is ported into shared `policy/` + `data/pedro/`, delete `content-source/`. See
`content-source/README.md`.

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

This is a new, remote-less repository with two commits so far (the initial skeleton and the
devcontainer); **the engine source is still uncommitted** and is the athlete's to commit after
review. There is no remote yet (Chunk 0 provisions a private one). Never commit `.env`,
`.mcp.json`, the Garmin token, or the DuckDB working files.
