# Task 3.4 — `coach running trailing-load`: the first deterministic command, with drift-control fixtures

**Chunk:** 3 — Plan schema, YAML persistence, first deterministic command
**Depends on:** 3.0 (its verify clause needs `--date`) and 3.3 (the fixture store).
**Blocks:** Chunk 4 (the brief reads summaries), Chunk 6.1 (which grows this plugin into the real
running specialist).
**Discipline:** **Test-first (TDD).** This is the drift-control task: the fixtures derived from the
protocol text *are* the deliverable, and the arithmetic is written to satisfy them.
**Recommended agent:** **Claude** — model **Opus 4.8** · **Effort:** high — designing the fixtures
from prose protocol into pinned arithmetic is the work, and this command's absence caused the
2026-06-24 miss the plan names.

## Context

Read `AGENTS.md`, the plan's **Chunk 3** and **Global Constraints**, **design spec §8** (*drift
control: the CLI owns arithmetic, policy owns thresholds; the CLI's definitions are unit-tested
against fixtures derived from the protocol text*), and the plugin contract **§2.3, §3.1–§3.4**.

The protocol text these fixtures derive from is in `content-source/protocols/`, and it is specific:

- **`running.md` → `## Monitoring` → `### ACWR`:** *"Acute km this week / 4-week rolling average."*
  Bands: `0.8–1.3` sweet spot · `1.3–1.5` caution, hold or trim next week · `>1.5` danger, reduce
  volume · `<0.8` detraining risk (**enforced** since 2026-06-12 — logs a corrective action).
- **`training.md` → `### Cumulative-Load Rules (trailing multi-day)`:** *stacked hard* is **≥2 hard
  sessions (quality, long run, or heavy legs) in the trailing 3 days** → the next day is easy or
  rest, never hard. And explicitly: *"a raw consecutive-run-day count is NOT a fatigue flag on its
  own"* — the flag is load without recovery.

Those two sentences are what "ACWR" and "hard session" mean in this system. Pin them.

**`content-source/` is raw material, not the live tree.** Porting it is per-domain, with that
domain's chunk (running is **Chunk 6**). This task ports **only the keys `trailing-load` reads** into
`policy/running/`; everything else in `running.md` stays unported. Restructure, do not copy — a
threshold lands as a policy key, never as a paragraph (amendments §2.3).

## Goal

One real deterministic command, reading policy thresholds and the fixture store, whose arithmetic is
pinned to the protocol text so it cannot drift silently.

## Deliverables

### 1. A minimal `running` plugin registered

Contract §2.3 makes `summary` mandatory, so registering the namespace means declaring one. Add a
`PluginDefinition` to `PLUGIN_REGISTRY` with `storeTables` covering what 3.3 seeded, and two verbs:

- **`summary`** — a **deliberate placeholder** that returns `null` facts **plus a first-class
  `{ field, reason, action }` gap** naming Chunk 6 as the remedy. It must not return `{}`, `0`, or
  a fabricated fact.

  This is not filler. Chunk 2's review found that the one thing nothing in the repo demonstrates is
  a *command* turning a missing value into a gap in the envelope — contract §3.3 puts that burden
  squarely on the summary, and every Chunk 5+ summary will copy whatever lands here. **Assert it
  end-to-end**: `coach running summary --profile=pedro --date=…` exits non-zero with exactly one
  envelope, `ok: false`, and a gap whose three fields are all meaningful.

- **`trailing-load`** — the real command, below.

Leave `stubPlugin` in place for now; it is Chunk 2's registration fixture and several tests bind to
it. Note in the report whether it can be retired once a second real plugin lands in Chunk 6.

### 2. `coach running trailing-load --profile=… --date=…`

Deterministic per contract §3.1: no SDK, no network, no clock read beyond the `--date` it is given,
no randomness. Same profile + same date + same on-disk state ⇒ byte-identical output. It returns the
standard envelope and computes, from the fixture store and policy:

- **ACWR** — acute (current week's km) over the 4-week rolling average, and the **band** it falls in.
- **Trailing hard-session count** over the policy-defined window, and therefore whether **stacked
  hard** fires.
- **Days since the last hard session.**

Two lines that must not blur (contract §3.4):

- **Allowed** — arithmetic with a threshold read from policy. Classifying today as "danger band" is
  arithmetic; so is "stacked hard fires".
- **Not allowed** — a readiness verdict, a day-type call, "should train easy". That is mediation and
  it belongs to the head coach. `trailing-load` reports *the flag fired*, never *what to do about it*.

### 3. `policy/running/` — only the keys this command reads

The ACWR band edges, the trailing window in days, the hard-session threshold count, and the
definition of which session kinds count as **hard** (quality, long run, heavy legs). Thresholds in
policy; arithmetic in code. Changing a band edge must change the output with **no code change** —
assert that with a test that overrides a band under `data/pedro/policy/running/` and sees the
classification move.

### 4. The drift-control fixtures

Derived from the protocol text above, each naming the sentence it pins in a comment. At minimum:
each ACWR band including both edges of the sweet spot, the `<0.8` detraining case (enforced, not
advisory), the stacked-hard case that fires, the high-frequency case that must **not** fire on
consecutive run days alone, and the boundary at exactly 2 hard sessions in exactly 3 days.

## Inherited invariants that bind this task

- **Missing ≠ zero.** A window with no data yields `null` plus a gap, never `0` and never an ACWR of
  `0`. A four-week average over two weeks of data is a gap, not a smaller denominator — decide the
  rule, state it in policy, and test it.
- **Deterministic `summary`** (contract §3.1) — and the same discipline for `trailing-load`.
- **Facts, not verdicts** (contract §3.4).
- **Prose is agent-readable, CLI-never.** No threshold this command uses may exist only in
  `running.md`. That file stays unported otherwise.
- **Profile isolation.** Policy overrides come from `data/<profile>/policy/running/`; the store read
  is profile-bound. Tests run against a temp `dataRoot` and `policyRoot`.
- **Comments:** short, only the non-obvious *why* — which protocol sentence each fixture pins, and
  why consecutive run days are not a flag.

## Acceptance criteria

- [ ] `coach running trailing-load --profile=pedro --date=<fixture-date>` returns the expected ACWR,
      band, hard-session count and days-since-last-hard from the seeded store, in one valid envelope.
- [ ] Every drift-control fixture passes, and each cites the protocol sentence it pins.
- [ ] Overriding a band edge under `data/pedro/policy/running/` moves the classification with **no
      code change**.
- [ ] Consecutive run days with no hard sessions do **not** raise stacked-hard.
- [ ] Exactly 2 hard sessions in exactly 3 days **does** raise it.
- [ ] A date with insufficient history returns `null` plus a gap naming what is missing — never `0`.
- [ ] The output carries **no verdict** — no day type, no readiness, no recommendation. Assert on
      the returned keys, not just by inspection.
- [ ] Two runs on identical inputs are byte-identical.
- [ ] `coach running summary --profile=pedro` returns exactly one envelope, `ok: false`, with a
      three-field gap naming Chunk 6.
- [ ] `coach running <verb>` for an unregistered verb is still the ordinary `unknown command` gap.
- [ ] All Chunk 1–2 tests pass unmodified; `npm test` green; `npm run typecheck` clean;
      `npm run lint` clean.

## Out of scope

The running **coach** and the SDK (**Chunk 5–6**). The rest of `running.md` — workout types, heat
rules, taper, race execution, the sub-T → threshold → 10K → VO2 ladder (**Chunk 6.1**). The
`targets` lookup, `validate`, `progress`, `reconcile` (**Chunk 6**). The real `summary` content
(**Chunk 6**). Live Garmin sync (**Chunk 4**). The brief (**Chunk 4**). `DatedFact` / `as_of` /
staleness horizons (**Chunk 4** — do not invent them here). Deleting `content-source/`.

## Definition of done

Report: the command's output shape; the exact policy keys ported and the protocol sentence each came
from; the rule chosen for insufficient history; the fixture list with what each pins; how the
"facts, not verdicts" line was held; the `summary` placeholder's gap verbatim; `npm test` output;
and anything in the protocol text that turned out **not** to be expressible as a threshold — that is
a signal the port needs a decision, so report it rather than encoding a guess.
