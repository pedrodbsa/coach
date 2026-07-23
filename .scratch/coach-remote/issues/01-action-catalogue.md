# 01 — Action catalogue

Type: grilling
Status: resolved

## Question

Write out every action in the system as an ordered step list, so that three clients have
something concrete to share. This is the backbone of the spec; most other tickets hang off it.

For each of `/plan`, `/log`, `/garmin`, `/body` and `/skin`:

- **Trigger and inputs** — what starts it, what it needs supplied.
- **Preconditions** — what must be true before it may run at all (for `/plan`: the morning
  weigh-in has landed and the Garmin sync is fresh). What happens when a precondition fails.
- **Steps, in order**, each tagged **deterministic** or **agent**. Deterministic steps become
  `coach` CLI calls; agent steps delegate to the model reading `protocols/*.md`.
- **Gates** — durable pause states, what renders them, and what resolves them. `/plan`
  already has one: `.claude/commands/plan.md` step 7 presents and stops, step 8 waits for
  approval, step 9 writes.
- **Outputs** — which files it writes, and which of those are structured versus prose.
- **Degraded behaviour** — what it does when data is missing rather than guessing.

Then two questions about the catalogue itself:

- Is it closed or extensible, and what does adding an action cost?
- Do any of the five split, merge, or disappear once written out honestly? `/skin` may be
  small enough to be a plain capture with no agent step at all.

## Context

- Existing command docs are the input: `.claude/commands/{plan,log,garmin,body,skin}.md`.
- Standing decisions 4, 9 and 10 on the map constrain the answer.
- Resolving this unblocks [08 — coach CLI/SDK surface](08-coach-cli-surface.md),
  [09 — Client affordance matrix](09-client-affordance-matrix.md) and
  [12 — Command doc rewrite](12-command-doc-rewrite.md).

## Answer

Resolved 2026-07-22.

### The catalogue

Seven actions, down from a nominal nine. The catalogue is **open** — actions can be added as
the system grows.

**`plan`** — the only action whose judgement comes first.

```
det     preflight: current-status staleness, forced garmin sync, brief
        (markers, trailing ledger, streak counts, DSW)
gate    needs-input — DSW endpoint returned nothing: what is the watch suggesting?
agent   decide: week shape re-derived, day type, prescribed session(s)
det     lookups: day type → calorie tier; gym → movements, working loads, rotation group
agent   compose the key-decisions summary
gate    needs-approval — approve or edit; an edit re-enters the agent step and re-opens the gate
det     write the structured plan + the journal; refresh the metrics snapshot
chain   → garmin.push on approval
```

**`garmin.push`** — no agent step at all.

```
det     read the approved plan; delete same-date workouts; build DTOs; upload
det     read back and verify enum survival; schedule; record workout IDs
```

**`meal.confirm`** — eaten as planned.

```
det     mark the meal row eaten; roll the day's actual/projected totals
```

**`meal.log`** — eaten differently.

```
det     ingest the described deviation; overwrite the meal row with actuals
agent   re-tune the remaining meals to hold the tier, respecting the protein-distribution
        rule and the fat floor
det     write; refresh expected / actual / projected
```

**`session.log`** — two sources, converging steps.

```
det     source A: pull the Garmin activity and the day's steps
agent   source B: parse what the athlete describes, when Garmin did not capture it
agent   flags — modified by sleep, pain or heat; deviations against the prescription
det     write actuals
```

**`adjust.day`** — the on-the-fly change. New; nothing in the spec covered it.

```
det     load today's structured plan and a fresh brief
agent   apply the change and recompute the knock-ons — session timing shifts meal timing,
        a skipped session re-tiers the day's food down, an ingredient swap re-balances macros
gate    needs-approval — only when the change alters the prescribed workout or moves the
        day's calorie tier; a like-for-like swap applies straight through
det     write; mark the watch stale when the workout changed
chain   → garmin.push when the workout changed
```

**`skin.capture`**

```
det     record verbatim; auto-attach the day's objective context from the structured plan
agent   infer one or two tags
det     append to the skin log
```

### Decisions taken

1. **One pause mechanism, two flavours.** An action that cannot proceed enters a durable
   paused state carrying a typed prompt: `needs-input` or `needs-approval`. Both survive the
   session; any client can render and resolve them. An edit at an approval gate re-enters the
   preceding agent step and re-opens the same gate, which is how `/plan` step 8's "iterate as
   needed" loop is expressed.
2. **`/log` splits** into `meal.confirm`, `meal.log` and `session.log`. Free text remains
   available as a thin dispatcher that routes to one of them — an agent step on the terminal,
   a button on the other two clients. The split is forced by the step lists: confirming a meal
   must never put an agent in the way of a tick.
3. **`note` is dropped**; `adjust.day` replaces it. What was wanted was never note-taking — it
   was changing today's plan mid-day and having the consequences follow.
4. **`/body` is dropped as an action.** The scale captures weight and the external
   Withings→Garmin job carries it in. "Current versus baseline versus target" becomes a
   **view**, not something invoked. Constraint handed to
   [11 — What the UI shows](11-ui-views.md).
5. **Actions chain, declared in the catalogue, gated where it matters.** `plan`'s approval
   fires `garmin.push` without a second tap — the approval already happened.
   `adjust.day` marks the watch stale and re-fires the push when the workout changed. The
   chain is data, so every client behaves identically and correctness does not depend on the
   athlete remembering the order.
6. **Policy and state separate.** `protocols/` becomes pure policy that **no action may
   write**; state moves out. This makes the standing "no protocol edits from Telegram" rule
   mechanically enforceable — a Telegram-invoked action may write state, never policy — rather
   than a judgement made per message. Charted as
   [13 — Policy/state split](13-policy-state-split.md).

### Findings handed to other tickets

- **`garmin.push` is only fully deterministic if the plan schema is complete.** `garmin.md`
  currently falls back at upload time to "derive HR from `running.md`" and "pick a load from
  the last logged session". Those are plan-time decisions. The schema must carry explicit
  per-step HR bands and explicit loads so that nothing is inferred at upload. Constraint added
  to [02 — Plan schema](02-plan-schema.md). This is what makes `garmin.push` safe to fire from
  a button, and what makes the chain in decision 5 sound.
- **`body.md` is stale** regardless of this map: it still says to ask for scale measurements,
  sync them to Garmin, and export CSVs. All three are wrong. For
  [12 — Command doc rewrite](12-command-doc-rewrite.md).
- **Three files in `protocols/` are written by actions**, and all three writes are state, not
  policy: the metrics snapshot (`current-status.md`, by `/plan`), Garmin enum verification
  status (`strength-exercises.md`, by `/garmin`), and appended observations
  (`skin-log.md`, by `/skin`). Two of them are genuinely mixed files and need splitting at the
  seam, not merely moving. For [13](13-policy-state-split.md).
- The Sunday weekly rollup currently living inside `/log` leaves with the `/week` effort. Its
  recap-then-draft chaining is expressible with decision 5's mechanism.

### Revision, same day

Two changes landed after the answer above was written. The behaviour it describes still holds;
how it is expressed changes.

1. **`adjust.day` has no gate.** The rule first written here — approve only when the workout or
   the day's tier changes — did not survive the question *"how would you know an ingredient
   swap is a direct swap?"*. It could not be known: "direct" was a category judgement dressed
   as a rule, and a gate condition the agent has to judge is not a gate. Gating was dropped
   rather than made computable, because the athlete initiates the change himself and the only
   consequential side effect, the watch re-push, is already replace-on-rerun and therefore
   idempotent. `adjust.day` now **applies, reports the resulting diff, and offers undo** —
   *"skipped the run, so the day drops to the rest tier: carbs 210→140"*. Every write is
   committed, so undo is cheap.
2. **These are workflows, not actions.** Actions are the primitives — build the brief, decide
   the session, resolve the tier, write the day. A workflow is an ordered composition of
   actions, gates and chains. `plan` is a workflow. The step lists above stay correct as
   descriptions of behaviour, but the units they list are actions contributed by **modules**,
   and the composition is what a profile can vary. See
   [14 — Modules, workflows and the profile](14-modules-and-profile.md).
