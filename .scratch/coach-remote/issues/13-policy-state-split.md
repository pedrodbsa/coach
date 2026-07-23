# 13 — Policy/state split

Type: grilling
Status: resolved

> Sequence with [14 — Modules, workflows and the profile](14-modules-and-profile.md). Both
> tickets cut the same documents apart, and resolving them independently will produce two
> incompatible seams. Ticket 14 may also reveal a third kind alongside policy and state:
> **profile data** — the phase timeline, race calendar, HR ceilings and baselines that are
> Pedro's rather than the system's.

## Question

[01 — Action catalogue](01-action-catalogue.md) settled the principle: `protocols/` becomes
pure policy that no action may write, and everything an action writes moves out into state.
What remains is where the seams actually fall.

Three files are written by actions today, and all three writes are state:

| File | Written by | What it writes |
| --- | --- | --- |
| `protocols/current-status.md` | `plan` | Key Metrics recovery rows, recent weigh-ins |
| `protocols/strength-exercises.md` | `garmin.push` | Garmin enum verification status |
| `protocols/skin-log.md` | `skin.capture` | appended observations |

Two of them are genuinely mixed and need splitting rather than moving:

- **`current-status.md`** holds the phase timeline, race calendar, goals and adherence targets
  (policy) alongside the metrics snapshot and `Last verified` (state).
- **`strength-exercises.md`** holds the movement library, gym equipment constraints and
  rotation groups (policy) alongside working loads, last-logged dates and enum status (state).
  It is currently described as the single source of truth for loads, which is a state claim
  sitting in a policy file.

`skin-log.md` looks like a pure move — it is a log, not a protocol — but check whether the
working-hypothesis ranking at the top is policy.

Decide:

- Where state lives, and what the paths are.
- Exactly where each mixed file splits, and what the policy half is left calling itself.
- Whether the loads belong in a document at all, or in the store now that one exists. They are
  quantitative, dated, and queried — but they are also hand-edited today and read by the agent
  as prose with judgement attached (`"push reps to 12 before loading"`).
- What updates: `AGENTS.md`'s protocol-lookup table, every command doc, and the memory index
  all reference these paths.

## Context

- Aligns the tree with the map's three-domain frame: actions, context/data, protocols.
- Makes the standing "no protocol edits from Telegram" rule enforceable in code rather than
  judged per message.
- Overlaps [12 — Command doc rewrite](12-command-doc-rewrite.md), which is already rewriting
  the references. Sequence them together or do this first.

## Answer

Resolved 2026-07-22, jointly with [14](14-modules-and-profile.md).

**It is four kinds, not two.** The ticket asked how to separate policy from state and the
documents answered with two more.

| Kind | Written by | Lifecycle | Per-person | Example |
| --- | --- | --- | --- | --- |
| **Policy** | the athlete, rarely | edited in place | shareable across profiles | Cumulative-Load Rules, workout types, meal distribution |
| **Profile** | the athlete, at setup | edited in place | his | HR zones 142/145/172, G1/G2/PT equipment, race calendar, goals, Bod Pod baseline |
| **State** | actions | overwritten | his | Key Metrics snapshot, working loads, weight |
| **History** | actions | appended, needs eviction | his | the Coaching Log |

Policy and profile are **read-only to every action**. State and history are what actions write.
That is the line decision 5 needs: a Telegram-invoked action may write state and history, never
policy or profile.

### The evidence that forced four

1. **The race schedule exists twice and has already drifted.** `running.md:58` and
   `current-status.md:47` both carry it, and they disagree — May 17 is `Done` in one and
   `Leisure` in the other, and only one holds the March HM row. The duplication exists because
   there is nowhere for *"his races"* to live that both a running protocol and a status
   document can reference. That is the missing **profile** kind, demonstrated by its absence.
2. **History has a different lifecycle from state.** State is small and current and gets
   overwritten. History grows without bound: the Coaching Log is **36 KB, 52% of
   `current-status.md`**, and every session that reads the file pays for all of it. Under API
   billing (see [03](03-claude-max-headless.md)) that is a line item, not untidiness.

### Where the seams fall

**`current-status.md` splits four ways** and ceases to exist as one document:

- profile — Athlete Profile, Goals & Priorities, Phase & Timeline, Race Schedule
- state — Body Composition, Training Load, Key Metrics, Aerobic Threshold Compliance,
  Strength Baselines
- policy — Adherence Targets, Active Constraints
- history — Coaching Log

**`strength-exercises.md` splits by column, not by section.** Its Exercises table interleaves
shareable reference and per-athlete state *in the same row*:

- reference/policy — exercise name, pattern and rotation group, rep role, Garmin
  `category`/`exerciseName` and its verification status
- profile — the Gyms & Equipment block, and the `Gym` column that filters by it
- state — working load × reps, last-logged date, and the progression notes

A heading-level cut cannot separate these. The movement library is shareable across profiles;
the loads are not. **Open question deliberately left for the schema work:** whether loads stay
in a document at all now that a store exists. They are quantitative, dated and queried — but
they are also hand-edited and carry prose judgement (*"push reps to 12 before loading"*) that a
numeric column cannot hold. See [02](02-plan-schema.md).

**`running.md` mixes policy with profile.** HR Zones, the Garmin Device Calibration offsets,
Current Periodization and Race Schedule are all his; the workout types, heat rules, taper and
race-execution patterns are policy.

**`training.md` dissolves entirely** — see [14](14-modules-and-profile.md).

**`skin-log.md`** is a plain move to history, except its standing working-hypothesis ranking,
which is policy.

### Consequence

`protocols/` as a directory name stops being accurate the moment profile, state and history
move out of it. Naming and final paths are implementation detail for
[12](12-command-doc-rewrite.md), which is already rewriting every reference.
