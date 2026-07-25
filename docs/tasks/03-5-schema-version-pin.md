# Task 3.5 — `schema_version` mismatch is a hard failure naming both versions

**Chunk:** 3 — Plan schema, YAML persistence, first deterministic command
**Depends on:** 3.1 (`schema_version` must be a comparable string) and 3.2 (`readPlan` is where the
check fires). Last task in the chunk.
**Blocks:** Chunk 3's review checkpoint, and therefore Chunk 4.
**Discipline:** **Test-first (TDD).** It is one behaviour with one failure mode; write it first.
**Recommended agent:** **Codex** — tier **Terra** · **Effort:** low — small and fully specified,
but it touches the error-code contract, which is part of the output surface.

## Context

Read `AGENTS.md`, the plan's **Chunk 3** and **Global Constraints** (*"`schema_version` pin. A
schema/policy version mismatch is a hard failure naming both versions. Prototype is at `0.2`."*) and
**design spec §8** (*drift control*).

`SCHEMA_VERSION = "0.2"` already exists in `src/models/envelope.ts` and is currently used only as
the envelope's own field. `src/models/error.ts` documents its `CoachErrorCode` union as *"part of
the output contract — rename one and a downstream consumer's branch goes dead"*; adding a code means
adding it and its factory together, in that file.

## Goal

A plan file written under a different schema fails **loudly and legibly**, rather than being read
under today's assumptions and silently mis-parsed.

## Deliverables

- **One `SCHEMA_VERSION_MISMATCH` code and factory** in `models/error.ts`, whose message names
  **both** versions — the one found in the file and the one the engine expects — and whose `action`
  states the remedy. Follow the file's existing conventions exactly: the code in the union, grouped
  under the right banner comment, with a doc comment saying why this is an error and not a gap.
- **The check in `readPlan`** (3.2): a plan whose `schema_version` is not the engine's is a **hard**
  failure. It fails *before* the plan is validated field-by-field — a version mismatch means the
  field-level violations would be noise about the wrong schema.
- **Decide, and record, whether the plan file's `schema_version` and the envelope's
  `SCHEMA_VERSION` are one constant.** The Global Constraints pin both at `0.2` and the prototype
  agrees, so **the recommendation is one exported constant, cited from both places.** If you split
  them, say why in a comment — a second version that can drift from the first is the exact class of
  problem this pin exists to prevent.
- **Note the policy half; do not build it.** The Global Constraints say *"a schema/**policy**
  version mismatch"*. Chunk 3 has no policy documents worth versioning yet (3.4 ports a handful of
  keys). Record it as a decision owed to **Chunk 5**, where the first real policy port lands, rather
  than inventing a scheme for documents that do not exist.

## Inherited invariants that bind this task

- **Structured JSON on stdout, always.** The mismatch reaches the caller as one envelope with
  `ok: false` and a gap — it does not escape as an unhandled throw. `CoachEngine.invoke` already
  guarantees this; the test must prove it end-to-end rather than assume it.
- **Missing ≠ zero.** A plan with **no** `schema_version` is a *different* failure from one with the
  wrong version. Do not collapse them: absent means the file is not a plan, mismatched means it is a
  plan from another era. Both are hard; the messages differ.
- **Drift control.** The pin is the mechanism; keep the arithmetic and the thresholds where they
  already are.
- **Comments:** short, only the non-obvious *why* — why the version check precedes field validation,
  and why one constant serves both surfaces.

## Acceptance criteria

- [ ] A fixture plan at `schema_version: "0.1"` read by `readPlan` fails hard with a message naming
      **both** `0.1` and `0.2`.
- [ ] The failure reaches the CLI as exactly one envelope, `ok: false`, exit non-zero, no Commander
      prose on stdout.
- [ ] A plan with **no** `schema_version` fails with a *distinct* message — not the mismatch one.
- [ ] A plan at the current version reads normally, and 3.2's golden tests still pass.
- [ ] The version check fires **before** field-level validation — assert that a file that is both
      wrong-version *and* structurally invalid reports the version, not a list of field violations.
- [ ] `SCHEMA_VERSION_MISMATCH` is in the `CoachErrorCode` union with a named factory, matching the
      file's existing conventions.
- [ ] `npm test` green; `npm run typecheck` clean; `npm run lint` clean.

## Out of scope

Policy-document versioning (**Chunk 5** — record the decision, build nothing). Any migration or
upgrade path between schema versions: v1 fails, it does not migrate. Bumping the version. The
store's schema (**Chunk 4**).

## Definition of done

Report: the error code and its verbatim message for both the mismatch and the absent case; where the
check sits relative to field validation and why; the ruling on one-constant-versus-two; the note
recorded for Chunk 5's policy versioning; `npm test` output; and any deviation.
