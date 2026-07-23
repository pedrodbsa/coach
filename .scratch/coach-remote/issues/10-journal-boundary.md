# 10 — Journal boundary

Type: grilling
Status: resolved
Blocked by: 02

## Question

With the day split into a structured plan and a prose journal, what belongs in each — and what
should stop being written at all?

The evidence, from `logbook/2026-07/2026-07-21.md` (260 lines):

| Section | Lines | Audience |
| --- | --- | --- |
| `## Today`, `## Workout`, `## Nutrition` | ~57 | The athlete |
| `## Actuals`, including five `####` flag essays | ~124 | Mostly the coach's own reasoning |
| `## Context — reference only` | ~76 | Explicitly labelled for the agent |

Decide:

- What stays as prose in the journal, and what shape it takes — the agent currently writes
  long analytical essays inside a day file, and the complaint that started this was that they
  are noise.
- What **graduates** to the coaching log in `protocols/current-status.md` because it is a
  durable decision rather than a day-local observation. That log already exists and is
  currently under-used, which is why decisions end up buried in daily files.
- What stops being written entirely. Cutting noise at the source beats hiding it behind a
  nicer UI.
- Is the journal agent-only, or does the athlete ever read it? Does any client expose it, or
  is it purely working memory?
- Does a day's reasoning need to survive at all once its decisions have graduated?

## Answer

Resolved 2026-07-23, jointly with [16 — System memory](16-system-memory-layers.md).

### The premise was wrong

The ticket assumed the long `####` blocks were noise to hide. Reading `2026-07-21.md`, they are
the most valuable output the system produces — and they are misplaced for a different reason
than length. On that day the blocks:

- discovered that a month of claimed fat loss was a **measurement artifact** (post-run readings
  compared against morning readings) and issued five corrective actions;
- created a new standing **sweat-rate metric** and a flag threshold;
- **cancelled** the Jul 27 – Aug 2 diet break with named tripwires;
- **revised the 71 kg goal** to ~73–74 kg;
- **triggered the −100 kcal carb trim**.

Almost none of that is journal material. It is changes to **policy** (`nutrition.md`, twice),
to **profile** (the goal), and to **history** (the coaching log) — written as prose in a daily
file, with propagation done by hand. It worked this time: `nutrition.md:54` does carry the
trim. It worked because someone remembered.

### The boundary

A day's reasoning has three fates, not two:

1. **Ephemeral** — working-out that mattered only to that day's plan. Stays in the day's
   **journal**, is never loaded again, exists for audit.
2. **A durable decision** — a change to policy, profile, or a coaching-log entry. Does not stay
   in the journal; it **graduates** through the `decide` workflow (below).
3. **A structured field** — day type, tier, loads, actuals. Already lives in the plan document
   ([02](02-plan-schema.md)), never in prose.

The `####` essay is a **derivation**. The decision is the artifact. The derivation stays in the
journal and is linked from the coaching-log row; the decision graduates. This is what makes the
journal genuinely disposable: nothing loads it in the normal path.

### What stops being written

The daily file's `## Context — reference only` section — readiness snapshot, streak counts,
trailing ledger, week-ahead table — is **brief output**, re-derived every morning and stored
nowhere durable. It stops being hand-written into the day; it is the brief, and it is thrown
away after the turn. That alone is ~76 lines of the 260 in `2026-07-21.md`.

### Durable changes go through a `decide` workflow

Decision 16 says policy and profile are read-only to *actions*. A durable change is therefore
**not an action** — it is a decision requiring the athlete's consent. The `decide` workflow:
the coach proposes the change with its derivation; the athlete approves; the CLI then
**atomically** appends the coaching-log row and applies the policy or profile edit. Web app and
terminal only, never Telegram — decision 5 as a mechanism rather than a rule. This is why both
Jul 21 policy edits carried the words *"athlete-agreed"* in the file: the consent was already
implicit in the process; this makes it structural.

**Refined 2026-07-23 into a three-party workflow (map decisions 30, 31).** A policy proposal
originates with the **sub-coach** that owns the domain — the strength coach proposes a load
progression, the nutrition coach proposes a tier trim. The **head coach** reviews for cohesion
across domains using the interaction rules it already owns (decision 17), requests adjustments,
and never opens the domain's internals. The **athlete** approves. So `decide` is
propose (sub-coach) → mediate (head coach) → approve (athlete) → atomic write (CLI).

Cadence: **weekly by default**, as part of the recap where all domains' proposals are gathered
and steered together; **ad-hoc for the rare urgent correction** (Jul 21 was applied immediately,
not deferred). The weekly invocation belongs to the out-of-scope `/week` effort; this map owns
the workflow, not the schedule.

### Journal exposure

The journal is agent-and-audit, not part of the athlete's normal read. A client *may* surface
it on demand — "why did you cancel the diet break?" opens the linked derivation — but it is
never in the default view and never in a session's loaded context.

### Consequence for other tickets

- The coaching log is the **history / global layer** of [16](16-system-memory-layers.md); this
  ticket and that one share one answer.
- `actual` fields stay in the plan document per [02](02-plan-schema.md); this confirms it. The
  *prose* about how a session felt is the only journal-resident actual.
- The `decide` workflow is a new entry for the action catalogue ([01](01-action-catalogue.md)),
  though it is a workflow, not one of the seven athlete-facing actions.
