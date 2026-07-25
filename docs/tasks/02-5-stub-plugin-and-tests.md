# Task 2.5 — Stub plugin + registration and storage-capability tests

**Chunk:** 2 — Plugin contract sub-spec + storage service + registration
**Depends on:** 2.3 (storage service) **and** 2.4 (registry). Last task in the chunk.
**Blocks:** Chunk 3.
**Discipline:** **Test-first (TDD)** — the stub exists only to be asserted against; the tests are
the deliverable and the stub is the fixture.
**Recommended agent:** **Claude** — model **Sonnet 5** · **Effort:** medium — medium-judgment work
in a contained surface, but it is the proof that the chunk's invariants actually hold.

## Context

Read `AGENTS.md`, the plan's **Chunk 2** ("How to verify"), and
`docs/superpowers/specs/2026-07-23-plugin-contract.md` — **§1.10 lists this task's verification
obligations** and §2 defines what conformance means.

This is the chunk's proof. Chunk 2 claims two things: an absent plugin is an absent namespace, and
a plugin's capabilities are bounded by the kind it is touching. Neither is true until asserted.

## Goal

A throwaway plugin that conforms to the contract, used **only** to prove registration and the
storage capabilities — deleted or clearly marked as a fixture, never a template for a real plugin.

## Deliverables

- A **stub plugin** declaring namespace `stub`, one deterministic `summary`, an empty
  `depends_on`, and no store tables. It exercises every kind it is allowed to: reads policy,
  reads profile, writes and reads state, appends history.
- **Registration tests** (the plan's verify clause):
  - `coach stub summary --profile=pedro` routes to it and returns a valid envelope.
  - Removed from the active set, `coach stub summary` errors "unknown namespace" — exit non-zero,
    exactly one envelope, no Commander prose on stdout.
  - The registry lists only active plugins and exposes `depends_on`.
- **Storage-capability tests** — the contract §1.10 obligations, asserted through the stub rather
  than against the store types directly, so they prove the *plugin-facing* surface:
  - Type-level: the stub cannot call a policy or profile writer (`@ts-expect-error` /
    `expectTypeOf`).
  - The stub cannot address another namespace — no method accepts one, and a crafted document id
    throws `PROFILE_SCOPE_VIOLATION`.
  - Policy reads resolve defaults-only, merged, and absent-both (`null`) cases; `layers()` reports
    both sides.
  - A missing document reads as `null`, and the **command** (not the store) turns it into a
    `{ field, reason, action }` gap — assert the gap comes out in the envelope, with `ok: false`.
  - `history.append` does not rewrite an earlier entry.
- Tests run against a **temp `dataRoot`** (`CoachDeps.dataRoot`), never the real `data/pedro/`.

## Inherited invariants that bind this task

- **Profile isolation.** These tests are the isolation proof at the plugin layer — err toward
  asserting an escape throws.
- **Missing ≠ zero.** Assert the gap's shape, not merely that `ok` is `false`.
- **Structured JSON on stdout, always** — exactly one envelope on every path, success or failure.
- **The stub is throwaway.** Do not port real coaching content into it; do not let it accumulate
  behaviour a real plugin would need.

## Acceptance criteria

- [ ] Every bullet under **Deliverables** has a corresponding test.
- [ ] The stub is unmistakably marked as a registration fixture (name and header comment).
- [ ] No test touches the real `data/pedro/` tree.
- [ ] The full Chunk 2 verify clause from the plan passes.
- [ ] All Chunk 1 tests still pass unmodified.
- [ ] `npm test` green; `npm run lint` clean.

## Out of scope

Any real plugin, `summary` *content* for a real domain, validators, coaches, DuckDB, the `decide`
path (`GovernedStorage` stays unwired this chunk).

## Definition of done

Report: the assertion list with what each one proves, anything in contract §1 or §2 that turned
out **not** to be assertable as written (this is the signal that the contract needs amending —
report it, do not quietly weaken the test), `npm test` output, and any deviation.
