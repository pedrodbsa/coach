# Task 1.4 — `coach core version` command (envelope end-to-end)

**Chunk:** 1 — Repo skeleton, toolchain, CLI entrypoint & output contract
**Depends on:** 1.1 (skeleton), 1.2 (envelope). Uses 1.3 if available.
**Blocks:** closes Chunk 1 — this is the chunk's end-to-end verification command.
**Discipline:** Light TDD — a test asserting the command's envelope output is expected.
**Recommended agent:** **Codex** — model **Luna** (fast/cheap tier) · **Effort:** low — trivial
pure-code wiring over the 1.2 envelope and 1.3 scoper; the hard decisions are already made
upstream, so Luna suffices.

## Context

Read `AGENTS.md` and the plan's **Chunk 1**. This is the trivial command that proves the CLI →
command-dispatch → envelope → stdout path works end-to-end, so Chunk 2 can layer plugin
registration on a known-good spine.

## Goal

`coach core version --profile=pedro` parses `coach <domain> <verb>`, scopes to `--profile`, and
prints a valid output envelope JSON to stdout.

## Deliverables

- Command dispatch in the CLI entrypoint that routes `coach core version` to a handler. Parse
  `--profile` (required) and reject a missing/invalid profile cleanly (via the 1.3 scoper's
  profile validation if present).
- The `core version` handler returns an envelope whose `data` carries the version info (e.g. the
  package version and the pinned `schema_version`), `ok: true`, `gaps: []`.
- The result is emitted **only** through the 1.2 serializer (single JSON document on stdout).

## Inherited invariants that bind this task

- **Structured JSON on stdout, always** — the command's sole stdout output is the envelope.
- **Profile isolation** — `--profile` is required and validated; do not default it silently.
- **The CLI is the one interface** — this command is invoked as the `coach` binary, not by
  importing the library.

## Acceptance criteria

- [ ] `coach core version --profile=pedro` prints a **valid envelope JSON** (parseable; four
      keys; `ok:true`; `gaps:[]`; `data` non-null with version + `schema_version`).
- [ ] A missing or malformed `--profile` is handled cleanly (non-zero exit and/or an envelope
      with a gap — pick one and test it; no raw stack trace to stdout).
- [ ] A test invokes the command and asserts the parsed envelope shape.
- [ ] `npm test` green; `npm run lint` clean.

## Out of scope

Any real domain command, plugin registration (Chunk 2), DuckDB, agents, YAML persistence.

## Definition of done

Report: the dispatch approach, the `core version` payload, the `--profile` handling choice,
`npm test` output, and any deviation. **This completes Chunk 1 — flag it ready for chunk
review.**
