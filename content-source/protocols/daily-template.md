# DAILY FILE TEMPLATE - MASTER

Every `logbook/YYYY-MM/YYYY-MM-DD.md` follows this structure. It is a coach's
journal entry, not a worksheet: the athlete reads the plan above the divider, and
the coach records what happened below it. The athlete never writes to the file —
`/plan` and `/log` populate it — so there are no checkboxes and no fill-in blanks.

## Required structure

```
# YYYY-MM-DD (Day) — <session headline>

## Today
## Workout
## Nutrition

---

## Actuals
## Context — reference only
```

### `## Today`

Four lines, no more:

- Day type — Rest / Easy / Quality / Long Run / Race
- Readiness call — Green / Modified / Rest
- Calorie target — phase and day-type tier
- Shape of day — one line describing how the day runs

### `## Workout`

Concise session detail.

- Running: distance, HR cap, pace guide, RPE. Note any heat or sleep modification.
- Strength: the exercise table — slot, exercise, sets x reps, rest, load note.
- Rest day: state it in one line, optionally offering the incline-walk NEAT block
  (`training.md` § Rest-Day NEAT) as a nice-to-have — NEAT is opportunistic, not a
  prescription; omit it when recovery is depleted or time is short.

### `## Nutrition`

A meal table (meal, time, meal, macros, status) plus a macro-tracking summary with
three rows — **Expected** (day-type tier), **Actual so far** (eaten meals), and
**Projected** (day end). `/plan` writes the morning plan; `/log` then makes the table
living: as each meal is eaten it **overwrites that meal's row in place** with the
actual and marks it eaten, then **re-tunes the remaining meals' targets** to hold the
day-type macros. This is the one place actuals are recorded above the divider, so the
athlete tracks the day's macro budget in a single view. No per-meal prose unless a day
genuinely needs a re-tune rationale.

### `## Actuals`

Coach-written through `/log` after the day runs — a record of what actually
happened, never a worksheet. No checkboxes, no `___` blanks: write only lines
that carry real content, and omit any category with nothing to record. A day
executed exactly to plan collapses to a single line (e.g. "Executed to plan; run
per Garmin `<id>`").

Record, when present:

- Run — distance, pace, average and max HR, RPE (from Garmin), plus any sleep,
  heat, or pain modification.
- Strength — per-exercise working load, reps, and RPE. This is the capture point
  `/report` promotes into `strength-exercises.md`.
- Meals — **only genuine deviations, swaps, and flags** (e.g. a meal swap, an
  underfueling flag on a quality or long-run day). The meal-by-meal record and the
  running macro total now live in the living `## Nutrition` table — do not duplicate
  them here.
- End-of-day data the coach pulls because it informs coaching — daily steps for
  the NEAT and expenditure read, a newer weigh-in if Garmin returned one, and
  that-night sleep only when notable.
- Subjective notes — how the session felt, any pain.

Skin is tracked weekly, not daily — acne evolves on a multi-week cycle, so daily
scoring is noise. The weekly skin assessment lives in `protocols/skin-log.md` and
is captured by `/report`, not in daily files.

### `## Context — reference only`

Sits below the `---` divider. Holds material not needed to act on the day: the
readiness data snapshot, the rationale for the day's calls, the streak counts,
the trailing-7-day load ledger, the rest-of-week table, notes and flags, and any
Garmin workout IDs written by `/garmin`.

## Rules

- Nothing above `## Context` may exceed what the athlete needs to act today.
- The athlete never writes to the daily file. `/plan` writes the plan zone and
  `## Context`; `/log` writes `## Actuals` and keeps the living `## Nutrition` table
  current (overwriting eaten meals, re-tuning the rest). No checkboxes, no `___`
  blanks anywhere.
- Standing daily commitments are not reproduced in daily files. They live in
  `protocols/coaching.md` under "Operational Floor". A daily file may reference
  that section but must not copy it.
- On Sundays the `## Context` section also carries the weekly check: ACWR,
  Composite Load, 7-day weight average, body-comp trend, and recovery flags.
