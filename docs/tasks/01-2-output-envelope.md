# Task 1.2 — Output envelope type + JSON serializer

**Chunk:** 1 — Repo skeleton, toolchain, CLI entrypoint & output contract
**Depends on:** 1.1 (skeleton + test harness must exist)
**Blocks:** 1.4 (the `core version` command emits an envelope)
**Discipline:** **Test-first (TDD).** Write the failing tests for the envelope shape and
serializer, then implement until green.
**Recommended agent:** **Claude** — model **Sonnet 5** · **Effort:** medium — small surface, but
the `ok`↔`gaps` rule and the missing≠zero semantics are design judgment the whole engine
inherits. Sonnet 5 is capable here; reserve Opus for 1.3.

## Context

Read `AGENTS.md`, the plan's **Chunk 1** and **Global Constraints**, and **spec §8** in
`docs/superpowers/specs/2026-07-23-remote-coach-v1-design.md`. Every `coach` command returns the
same envelope; this task defines it once for the whole engine.

## Goal

The single output-envelope type and a serializer that always prints it as JSON on stdout, with
first-class gaps.

## Deliverables

- The **envelope type**:
  `{ ok: boolean, data: <T> | null, gaps: Array<{ field: string, reason: string, action: string }>, schema_version: string }`
  — generic over the `data` payload `<T>`.
- A **gap** helper/type: `{ field, reason, action }`. A gap is how "missing" is expressed
  (see invariant below).
- A **serializer** that takes an envelope and writes exactly one JSON document to **stdout**
  (no trailing prose, no logging to stdout). Decide and document how `ok` relates to `gaps`
  (e.g. presence of a hard gap vs `ok:false`) — keep it consistent and tested.
- The `schema_version` constant, pinned. The prototype schema is at **`0.2`** — use that as the
  current value unless the schema task (Chunk 3) has already moved it; if so, read it from the
  shared constant rather than re-hardcoding.

## Inherited invariants that bind this task

- **Missing ≠ zero.** A missing value is `null` **plus** a first-class gap
  `{ field, reason, action }`; a real zero is `0`. The type and serializer must make it
  natural to express "value is null AND here is the gap explaining why," and must never coerce a
  missing value into `0` or drop the gap.
- **Structured JSON on stdout, always.** The serializer is the *only* sanctioned way a command
  emits its result. Human-readable rendering is a client concern, not the CLI's stdout.

## Acceptance criteria

- [ ] A unit test asserts the envelope serializes to valid JSON with all four keys present,
      including an empty `gaps: []` on a clean success.
- [ ] A unit test asserts a gap round-trips with exactly `{ field, reason, action }` and that a
      `null` `data` can coexist with a populated `gaps` array (the missing≠zero case).
- [ ] A unit test asserts the serializer writes to stdout and produces a single parseable JSON
      document (no extra lines).
- [ ] `schema_version` is present and equals the pinned value.
- [ ] `npm test` green; `npm run lint` clean.

## Out of scope

Any specific command, the profile-scoper (1.3), gaps produced by real data sources (later
chunks), schema-version *mismatch* handling (Chunk 3.5).

## Definition of done

Report: the envelope/gap types, the `ok`↔`gaps` rule you chose, the tests added, `npm test`
output, and any deviation.
