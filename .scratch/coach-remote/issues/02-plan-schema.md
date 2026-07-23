# 02 — Structured plan schema

Type: prototype
Status: resolved

## Question

What does the structured day file hold?

It has four consumers, and the schema has to serve all of them at once:

1. **The agent** writes and edits it, reliably, without a validator catching it out every time.
2. **The UI** renders it as cards with zero prose — "what is my workout", "what is my meal
   plan" answered at a glance.
3. **`/garmin`** turns the workout into MCP calls (`create_strength_workout`,
   `create_walk_run_workout`, `schedule_workout`) without re-parsing prose.
4. **The store** projects it into DuckDB without any NLP.

Cover at minimum: the workout (steps, targets, HR bands, strength movements with load and
reps); nutrition (meals, items, grams, macros, timing); actuals; flags; day type and tier.

Decide the format (YAML, JSON, or frontmatter in a markdown file), the file naming alongside
the prose journal, and where free text is still allowed — a per-item note field may be needed
so that nuance like the fruit-dessert swap or "hold whole eggs to ~3" is not lost.

## How to resolve

Prototype it. Rebuild `logbook/2026-07/2026-07-21.md` in the proposed shape and react to the
result. That file is the honest test case: 260 lines, of which roughly 57 are athlete-facing.

## Constraint from ticket 01

**`garmin.push` must have no agent step**, because the action catalogue chains it to `plan`'s
approval without a second tap. That only holds if the schema carries everything the upload
needs, explicitly:

- a per-step HR band or pace target on **every** run step, warmup and cooldown included;
- an explicit load on every strength movement, with the Garmin `category` / `exerciseName`
  already resolved.

`garmin.md` currently falls back at upload time to "derive from `running.md`" and "pick a load
from the last logged session". Those are plan-time decisions and the schema has to absorb
them. If the schema cannot, `garmin.push` needs an agent step and the chain has to be gated.

## Context

- Standing decision 8 on the map.
- This subsumes the original spec's "frontmatter-ise the daily template" item. If the plan is
  data, there is nothing left to frontmatter-ise and the extractor reads the file directly.
- Resolving this unblocks [10 — Journal boundary](10-journal-boundary.md) and
  [11 — What the UI shows](11-ui-views.md), and lets the store and extractor graduate out of
  the fog.

## Answer

Resolved 2026-07-22. Prototype: `../prototypes/2026-07-22.plan.yaml` — a rebuild of
`logbook/2026-07/2026-07-22.md` in the proposed shape, kept as the primary source for this
decision.

### Shape

The document is **partitioned by module**. Each module owns a root-level block containing its
plan, its validators and its actuals; the head coach and the brief sit at root alongside them.

| Block | Written by | Holds |
| --- | --- | --- |
| `decision` | head coach | day type, readiness verdict, rules fired and why, and what each module is asked to produce |
| `markers` | the brief (code) | sleep, HRV, RHR, body battery, stress — facts, never verdicts |
| `running` | running coach | `session` with targeted steps, `validate`, `actual` |
| `strength` | strength coach | `session` with movements, loads and Garmin enums, `validate`, `actual` |
| `nutrition` | nutrition coach | `tier`, `meals[]`, `totals`, `validate` |

A first draft sectioned the document by *kind* — all sessions together, all meals together, all
constraints collected — and that was wrong in a way worth recording: it claimed to section by
writer, then pulled the validators out into a shared block, breaking the very principle it
claimed. **Validators belong inside the module they check**, because the module owns them.

### Decisions

1. **A one-line `why` per element, hidden by default.** Any prescribed thing may carry a single
   sentence explaining itself, attached to the element rather than collected in a section. The
   UI shows the *what* and reveals the *why* on tap. Anything longer belongs in the journal.
   The one-sentence cap is the mechanism — without it the essays regrow. Today's file spends
   four lines at the bottom of the Nutrition section explaining why the snack sits at 17:30;
   attached to the snack it is one line.
2. **The CLI is the only writer.** Specialists return structured **JSON** as their output
   contract; `coach` validates and persists **YAML**. The agent never hand-edits the file, so
   the on-disk format is chosen for the athlete and for git diffs rather than for model
   reliability. `meal.confirm` becomes `coach nutrition confirm breakfast`, not an agent
   rewriting a line.
3. **A specialist reads the head coach's decision, its own block, and the blocks it declares a
   dependency on.** Nothing else. The nutrition coach sees the sessions because it declared
   `depends_on: [running, strength]`; the running coach never sees the meal plan.

   The declaration already had to exist — it is what orders the specialists, since fuelling
   depends on the session's duration and intensity. It costs nothing to make the same
   declaration scope what each one reads. This is also **why module-partitioning matters**:
   partitioned by kind, "the sessions but not the meals" is not a slice that can be taken.

   The exclusion cuts both ways deliberately. It keeps each context small, and it stops a
   running coach commenting on carbs — a whether/what judgement that belongs to the head coach
   under decision 20.

   The head coach reads everything, by design. Decision 11 says modules partition ownership,
   not context, and being holistic is the head coach's job.

### What the prototype revealed

- **It removes a live duplication.** The current file states the day's shape twice — the
  *"Shape of day"* bullet and again as times in the meal table. Structured, times live on the
  meals and the timeline is derived.
- **Reps have three shapes** in a single session: a per-set list `[10,10,10,8]`, a range
  `{min,max}`, and a per-side count `{value,per}`. Any schema that assumes one breaks
  immediately.
- **Some content resists structure and should stay a note.** *"If set 1 flies, go 115 kg"* is a
  conditional progression rule that would need a DSL. *"Hold the HR and let pace be the
  readout"* is coaching intent, not data.
- **No food database, so macros are per meal, not per item.** Sufficient for the validator,
  which needs meal totals. The cost: *"swap the chicken for tofu"* requires the agent to
  recompute rather than look up.
- **`compare_to` on the control run** references the previous comparable session. That is a
  query result rather than plan data, and probably belongs to the brief — flagged for
  [08](08-coach-cli-surface.md).

### Constraint from ticket 01, satisfied

`garmin.push` needs no agent step: every run step carries an explicit target and every movement
carries a resolved load plus its Garmin `category`/`exercise_name`. `coach running validate`
enforces the first, which is the same check map decision 21 requires to make a downgraded
specialist safe. The chain from `plan` approval straight to the watch therefore holds.

### Left open

- Whether working loads stay in a document or move to the store — deferred here and in
  [13](13-policy-state-split.md), because they carry prose judgement a numeric column cannot
  hold.
- Whether `actuals` stays in this file or becomes its own document. The prototype keeps it
  inside each module's block; [10](10-journal-boundary.md) should confirm.
- **Where `depends_on` belongs.** The prototype records it per-day inside
  `decision.prescribes`, but "fuelling needs the session" is *always* true, so it arguably
  belongs once in the workflow document ([14](14-modules-and-profile.md), decision 18) rather
  than being restated every day. The per-day record of *which* modules were prescribed is still
  useful. Minor, but the two should not disagree.
