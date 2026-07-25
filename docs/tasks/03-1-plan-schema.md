# Task 3.1 — The plan schema, with the five fields the 2026-07-25 amendments add

**Chunk:** 3 — Plan schema, YAML persistence, first deterministic command
**Depends on:** Chunk 2 (done, reviewed). Independent of 3.0 and 3.3 — can run in parallel.
**Blocks:** 3.2 (`writePlan`/`readPlan` validate against this), 3.5, and — through the plan file —
Chunks 4, 5, 6, 7, 8, 9 and 12.
**Discipline:** **Test-first (TDD).** The plan's Global Constraints name the schema as a
deterministic engine part. Write the acceptance and rejection cases before the types.
**Recommended agent:** **Claude** — model **Opus 4.8** · **Effort:** high — the bulk is
transcription, but the five added fields are semantic decisions the amendments call the sharpest
edges in the design, and the field names are the single contract every later chunk consumes (plan
§Self-Review, *Type consistency*). Getting one wrong is expensive downstream.

## Context

Read `AGENTS.md`, the plan's **Chunk 3** and **Global Constraints** (including *Added 2026-07-25 —
the coaching loop*), **design spec §6** (the daily artifact — the schema's rules), and
`docs/superpowers/specs/2026-07-25-coaching-loop-and-identity.md` **§1.3, §2.3, §3.3, §6.1–§6.3**
plus the plugin contract **§6.3 and §6.7**.

The reference shape is `.scratch/coach-remote/prototypes/2026-07-22.plan.yaml` — read it in full.
It is the **structure** of record: root `schema_version` / `date` / `profile` / `title`, then
`decision`, `markers`, and one block per module owning its `session`/`meals`, its `validate` and
its `actual`, then root `flags`.

**The prototype predates every 2026-07-25 field.** Extend it; do not match it exactly. It is also
throwaway working material, not authority — where it and a spec disagree, the spec wins.

## Goal

The plan file as typed structures plus one runtime validator, so the CLI can turn a specialist's
JSON into a plan it is willing to persist — and refuse the ones it is not.

## Deliverables

- **`src/models/plan.ts`** (or `src/plan/schema.ts`; pick one and be consistent): the typed
  structures below, and a **validator** `validatePlan(value: unknown)` returning either the typed
  plan or the standard violation list `{ ok, violations: [{ rule, expected, actual, severity }] }`
  fixed in the Global Constraints. Severity `hard` blocks; `warn` annotates. 3.2 persists only what
  this accepts.

### The structure carried over from the prototype

Root `schema_version`, `date`, `profile`, `title`; `decision` (day type, readiness,
`rules_fired[]`, `prescribes[]` with per-module `intent`, `because?`, and **`depends_on`**);
`markers` (facts only); `running` / `strength` / `nutrition` blocks; root `flags`.

Three shapes the design spec §6 calls out explicitly and that the prototype exercises:

- **Reps in three shapes** — per-set list `[10, 10, 10, 8]`, range `{ min, max }`, per-side
  `{ value, per }`. All three, as a discriminated union; do not normalise them into one.
- **A per-item `note`** for content that resists structure (`"if set 1 flies, go 115 kg"`).
- **A one-line `why` per element**, one-sentence cap, hidden by default.
- Per-movement **`garmin` enums** (`category`, `exercise_name`, `status`), and per-session
  `garmin: { push, workout_id }` — Chunk 8 pushes off these with no agent step.

### Two prototype defects to correct, not copy

1. **`schema_version: 0.2` is unquoted**, so YAML parses it as a **float**. `0.2 ≠ "0.2"`, and
   `0.20` would silently collide with it. Make it a **string**, matching
   `SCHEMA_VERSION` in `models/envelope.ts`. 3.5 depends on this being comparable.
2. **`prescribes[].tier: phase5_easy_strength`** has the head coach naming a *nutrition internal*.
   The head coach prescribes intent and an acceptance condition; the domain owns the *how*
   (amendments §1.1, §7). Either it becomes the prescription's acceptance condition, or it goes.
   **Decide and record the reasoning in a comment** — this is the boundary the next four chunks
   lean on.

### The five fields added 2026-07-25

Each is owed to this chunk by name. Get the semantics from the amendments, not from intuition.

1. **`petitions[]` on each module block** (contract §6.7, §6.3). Shape is fixed:
   `{ from, need, why, horizon? }` — **no `target` field**, deliberately; a petition is addressed to
   the head coach, full stop. `from` is set by the runner from the emitting step, never by the coach.
   It lives in the plan file rather than state because it is mediated on a *later* decision and the
   plan is what git keeps.

2. **An acceptance condition on each `prescribes[]` intent** (amendments §1.3, §6.2). This is the
   subtle one. It is what "done" looks like in the head coach's terms, so the domain's `validate`
   has something external to check and the head coach can judge delivery without reading domain
   internals. It is therefore bound by the **prose rule** (amendments §2.3): *nothing a validator
   checks may live only in prose.* A free-text sentence would be unreachable by every check that
   exists to consume it. Require a **structured, machine-checkable** shape; a one-line `why` may sit
   beside it, never instead of it. Chunk 7.5's `coach head validate` checks that every intent
   carries one — design the field so that check is possible.

3. **Brief provenance on the decision** (amendments §3.3): the decision records the `computed_at` of
   the brief it was made against, so *"was this decided on stale premises"* is answerable from the
   artifacts alone. Chunk 4 produces the `computed_at`; this chunk defines where it lands.

4. **A stable `action_id` on every athlete-facing action** the plan prescribes — each session, each
   meal (amendments §6.2). **Core owns action identity.** Two properties the type must make
   possible: it is unique within a plan, and it **survives an `amend`** — a log targeting an action
   must still land after the domain re-derives that action, or every pre-fact correction orphans its
   own log row.

5. **`at` / `occurred` / `mode` on every logged entry** (amendments §6.3), where `mode` is `amend`
   (before the fact — the prescription changes) or `report` (after — the outcome differed). `at` is
   when it was said; `occurred` is when the thing happened or will happen. This chunk carries the
   **fields**; the deterministic defaulting from the action's window is **Chunk 9**. Logged entries
   belong under the module's `actual`. Model `actual` as `null` (nothing yet) versus present —
   never `{}`, and never an empty list standing in for "no signal": silence is `unknown`, and
   `unknown` is a state, not a zero.

## Inherited invariants that bind this task

- **Missing ≠ zero.** A field with no value is `null` and the *command* raises the gap. The schema
  must be able to represent "not yet" distinctly from "zero" everywhere it matters — `actual`,
  every macro total, every marker.
- **Prose is agent-readable, CLI-never.** A `note` and a `why` are for the athlete and the agent.
  Nothing a validator checks, a summary computes with, or a lookup resolves may live *only* there.
  This binds field 2 above hardest.
- **The CLI is the only writer of coaching content.** These types are what a specialist's JSON is
  validated *against*; no agent hand-edits the file.
- **Every run step carries an explicit HR/pace target and every movement a resolved load** plus its
  Garmin enum — the schema must make a targetless step or an unresolved load *representable but
  detectable*, because Chunks 6 and 8 assert on exactly that failure.
- **Comments:** short, only the non-obvious *why* — why reps stay three shapes, why the acceptance
  condition is structured, why `action_id` must survive an amendment.

## Acceptance criteria

- [ ] The prototype YAML, with only the two corrections above applied, validates clean.
- [ ] All three rep shapes round-trip as distinct shapes; a fourth shape is a **hard** violation.
- [ ] `petitions[]` accepts `{ from, need, why, horizon? }` and **rejects a `target` field**.
- [ ] A `prescribes[]` entry with **no acceptance condition** is a hard violation naming the module.
- [ ] A `prescribes[]` entry whose acceptance condition is only prose is a hard violation — assert
      this explicitly; it is the prose rule's one enforcement point in this chunk.
- [ ] The decision carries the brief's `computed_at`; a decision without it is a hard violation.
- [ ] Every prescribed session and meal carries an `action_id`; a duplicate within one plan is a
      hard violation naming both.
- [ ] A logged entry validates with `at`, `occurred` and `mode ∈ {amend, report}`; any other `mode`
      is a hard violation.
- [ ] `actual: null` and an absent `actual` are both legal and distinguishable from an empty result.
- [ ] `schema_version` is a **string** and a float `0.2` is a hard violation naming the type.
- [ ] A run step with no `target`, and a movement with no resolved `load`, are each representable
      and each detectable (the check itself may be a `warn` here — Chunks 6 and 8 make them hard).
- [ ] `npm test` green; `npm run typecheck` clean; `npm run lint` clean.

## Out of scope

Persistence (**3.2**). The `schema_version` **mismatch failure** (**3.5** — this task only makes the
field comparable). The brief itself (**Chunk 4**). Any domain's `validate` *content* — the protein
boluses, the every-step-target check, the resolved-load check (**Chunks 5–6**). Defaulting `mode`
from the action window (**Chunk 9**). `DatedFact` / staleness horizons (**Chunk 4**). Porting any
real coaching content out of `content-source/`.

## Definition of done

Report: the exported type surface; the shape chosen for the acceptance condition **and why it is
checkable**; how `action_id` stability across an amendment is expressed; the ruling on
`prescribes[].tier`; anything in the prototype that turned out not to be representable as written
(that is a signal, report it rather than quietly reshaping it); `npm test` output; and any deviation
from the amendments — deviating requires flagging, not silence.
