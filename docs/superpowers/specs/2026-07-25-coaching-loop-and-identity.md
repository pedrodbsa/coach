# Remote Coach — Coaching Loop, Identity, and Logging

**Date:** 2026-07-25
**Status:** Complete — §1–§7.
**Parent specs:** `2026-07-23-remote-coach-v1-design.md` (the *why*) and
`2026-07-23-plugin-contract.md` (the plugin seam). Where this document and either parent
disagree, **this one wins for the areas it names** and the parents stand everywhere else; the
superseded passages are listed in §8. Places where both parents are *silent* and this document had
to choose are marked **⚑ contract choice**; §8 collects them with the obligations they create.

> **§1** the head coach is a plugin · **§2** identity and profile documents · **§3** freshness and
> provenance · **§4** state versus summary · **§5** the progression loop · **§6** actions,
> completion and logging · **§7** proposal gatekeeping · **§8** what this supersedes, and
> obligations on later chunks.

The shape this document serves, stated once so every decision below can be checked against it:

> The athlete's intent funnels through the **head coach**, which sets vision, weighs domains
> against each other, and prescribes high-level intent downward. Each **domain** owns execution of
> that intent — the *how*. Progression is recorded so both parties can see whether things are going
> to plan, and adjust when they are not. Everything person-specific is **data**, so the same logic
> serves several people.

The architect/team analogy is exact and worth keeping in mind: the head coach writes the ticket and
the acceptance criteria; the domain does the work and reports against them; nobody re-does anybody
else's job, and nobody reads anybody else's internals to check.

---

## 1. The head coach is a plugin

*Parent: design §3 (head coach decides whether/what; specialists decide how), §4 (the head coach
mediates; head-coach rules quantify over the vocabulary active specialists register), §8
(`AGENTS.md`'s primer becomes scoped head-coach policy); contract §1.3 (the coaching log is the
head coach's history), §1.6, §2.5, §3.1.*

### 1.1 Decision

**The head coach is a plugin like any other. Its breadth is an `input` difference, never a
`capability` difference.**

It registers the namespace `head`, receives one namespace-bound `Storage` (contract §1.5), and gets
policy defaults ⊕ overrides, profile, state and history on exactly the terms every other plugin
gets them. It holds **no privileged handle**, and it can no more read another namespace's documents
than `household` can.

What makes it the head coach is what the **workflow step hands it**:

| Input | Where it comes from | Cost |
| --- | --- | --- |
| The **brief** — every active plugin's `DomainSummary`, keyed by namespace | deterministic CLI code (contract §3.1) | zero agent calls |
| **Petitions** raised by specialists on the previous run | the plan file's module blocks (contract §6.7) | zero |
| Its own policy, profile, state, history | its own `Storage` | zero |
| `coach query` **as a tool** | core, deterministic, on demand | zero agent calls |

That last row is the answer to the efficiency worry that motivated this section. The alternative
designs both cost more:

- **Specialists feed the head coach.** N agent calls before the first decision, on every `plan`,
  every `adjust.day` and every nudge — for a pipeline stage that is pure arithmetic. Contract §4.7
  already rejects the same shape for the same reason.
- **The head coach reads domain trees directly.** No agent calls, but its context now holds raw
  policy, state and history for every active domain. The summary exists *as* a context-leanness
  device (design §3); direct reads spend the most tokens on the most expensive model in the system,
  and the spend grows with every plugin added.

Deterministic summary → brief is cheapest on both axes, and `query` gives a **lazy pull** for
anything the brief does not carry. Eager load is bounded; lazy pull is on demand; neither is an
agent call.

### 1.2 Always active; the one plugin a profile cannot deselect

Contract §2.6 makes the active set a profile-kind document. **`head` is exempt: it is always
active.** A profile without a head coach has no mediator, so it has no `decide`, no `plan` and no
way to weigh one domain against another — it is not a degraded deployment, it is not a deployment.
Its absence is therefore a startup error, not a gap.

`head` is **spoken for**, but it is deliberately **not** added to contract §2.5's core-reserved list
(`core`, `brief`, `sync`, `query`, `run`, `resume`). Those names are reserved *against* plugins;
`head` is a plugin's own namespace, and reserving it core-side would reject the head coach's own
registration in Chunk 7. Two plugins claiming it is structurally impossible in any case — the
registry is keyed by namespace — so what needs enforcing is the exemption above, not a collision.

### 1.3 What it owns

```
coaches/head/COACH.md                        identity (§2) — logic tree, builder-authored
policy/head/*.yaml                           the readiness tree, the Cumulative-Load Rules,
                                             double-day fuelling — design §5's dissolved training.md
data/<profile>/policy/head/*.yaml            this person's overrides
data/<profile>/profile/head/*.yaml           the person as the head coach sees them
data/<profile>/state/head/*.yaml             current block, the standing decision
data/<profile>/history/head/coaching-log.jsonl   the coaching log (contract §1.3 anticipated this)
```

It **declares a coach**, so by contract §4.3 it declares a `validate` verb. That validator checks
the *decision*, structurally: every module block carries an intent, every intent names an active
plugin, every rule cited exists in policy, and every acceptance condition (§6) is expressed in terms
some domain can actually check. A malformed decision is caught before five specialists run on it.

Its mandatory `summary` (contract §2.3) is the standing decision state — today's day type, the
readiness verdict as decided, open petitions, open proposals. This is what the web app's Today view
reads, and it is why `summary` being mandatory on every plugin turns out not to be an awkward fit
for this one.

### 1.4 Rejected alternative — the head coach as core, not a plugin

Keeping it in the core is the status quo and looks simpler. Rejected on three counts:

1. **Its policy needs the defaults ⊕ overrides split.** The readiness tree and the Cumulative-Load
   Rules are the biggest policy block in the system (design §5) and are exactly the thing a second
   person must be able to override without forking the logic tree. Core-side, it would need a
   bespoke second implementation of the layering that contract §1.4 already provides.
2. **Its history is already a namespace.** Contract §1.3 files the coaching log under
   `history/<ns>/` and calls it the head coach's. Core-side, that line has no owner.
3. **Uniformity is what makes the boundary checkable.** If the head coach is core, "does anything
   hold a privileged handle" becomes a per-file judgement again. As a plugin it is subject to the
   same type-level test as everyone else (contract §1.10), and *"no code in this system reads across
   a namespace"* becomes a statement with no exceptions.

---

## 2. Identity and profile documents

### 2.1 Identity is logic, not data

**⚑ contract choice.** Neither parent covers per-coach identity; only *model* and *effort* exist,
and those are workflow-step properties (design §3, decision 21).

**A coach's identity document lives in the logic tree at `coaches/<ns>/COACH.md`, is
builder-authored, and has exactly one layer.**

Identity is *"you are a running coach with deep experience across training methodologies"* — a
property of the **coach**, not of the athlete. It is therefore on the builder's side of the
path-disjoint boundary (design §13), alongside code and shipped policy, and the server never writes
it. That single fact resolves the problem that would otherwise dominate this section: **markdown
does not merge.** With one layer there is nothing to merge, no `layers()` equivalent to define, and
no prose diff to render at an approval gate.

It is deliberately **not a fifth data kind**. It appears in no `Storage` handle; the plugin never
reads it. The **runner** reads it when composing a prompt for that domain's coach — the same place
model and effort are already resolved.

Per-person variation does not fork the file:

| The athlete wants | Where it goes |
| --- | --- |
| A different training philosophy (minimalist vs high volume) | **policy** — base ⊕ override, already steerable through `decide` |
| A different tone (blunt vs encouraging) | **profile** — `profile/core/coaching-style.yaml`, injected by the runner |
| A different coach entirely | a different plugin, or a fork of the logic tree — which is a deployment decision, not a data one |

### 2.2 Profile is structured, with room for prose

**The profile kind stays YAML. Free text lives in designated `notes` fields inside it, never in a
separate markdown document.**

Two levels, both already in contract §1.3:

- `profile/core/*.yaml` — the person, owned by no domain: goals, constraints, standing context.
- `profile/<ns>/*.yaml` — the person *as that domain sees them*: HR zones for `running`, equipment
  for `strength`, the race calendar.

Each namespace has a canonical `profile` document by convention (`profile/<ns>/profile.yaml`) and
may add others. A `notes` field may appear at document or section level.

Why not markdown: a summary computes from structured keys, and a missing key is `null` **plus** a
gap (`missing ≠ zero`). A missing *sentence* is unrepresentable — there is no field name to hang the
gap on and no remedy to state. Markdown would silently opt every profile fact out of the one
invariant that makes the system honest about what it cannot see.

### 2.3 The prose rule

Prose is **agent-readable, CLI-never**. Concretely:

- Nothing a validator checks, a summary computes with, or a lookup resolves may live **only** in
  prose. If a number matters mechanically, it exists as a structured key; a note may describe it,
  never be its only home.
- This applies to `COACH.md` as much as to `notes`. Identity carries *judgement and voice*; rules
  and thresholds carry *numbers*, in policy YAML.

This is not fastidiousness. Design §5 records `training.md` **dissolving** precisely because the
system's biggest block of rules lived as prose under one specialist's name, unreachable by any
check. A per-plugin markdown file is the most natural place in this architecture for that failure to
regrow, which is why the rule is stated here rather than left to taste.

---

## 3. Freshness: facts carry provenance

*Parent: design §8 (sync-then-query; a failed sync is a loud gap), contract §3.1–§3.3.*

### 3.1 The problem this fixes

A `DomainSummary` is computed on demand and is deterministic, so it cannot itself go stale — there
is no cached artifact to invalidate. What can go stale is the **data underneath it**, in two
flavours, and only one was covered:

- **Missing** — covered. `null` plus `{field, reason, action}`; a failed Garmin sync is a loud gap
  that switches to the MCP fallback rather than proceeding silently on stale data.
- **Present but old** — **not covered.** A weight from nine days ago raises no gap because it is not
  missing, and the head coach consumes it as current.

### 3.2 Decision

**⚑ contract choice. Every dated fact in a `DomainSummary` carries its own `as_of`. The domain's
policy declares a staleness horizon per fact. Past the horizon, the summary emits the value *and* a
staleness gap.**

```ts
export interface DatedFact<T> {
    readonly value: T | null;
    /** The date the value describes — not the date it was read. Null iff value is null. */
    readonly as_of: IsoDate | null;
}
```

```
weight: { value: 71.2, as_of: "2026-07-16" }   horizon 3d  → gap: weight is 9 days old
acwr:   { value: 1.14, as_of: "2026-07-25" }   horizon 1d  → fresh
hrv:    { value: null, as_of: null }                       → gap: missing; action: sync Garmin
```

This stays inside contract §3.4's line between facts and verdicts: comparing a date against a
threshold **read from policy** is arithmetic, exactly as ACWR and deload classification already are.
`DatedFact` is a small fixed-shape record, which contract §3.2 already permits.

A dated fact whose policy declares **no** horizon is a **build-time** failure, not a runtime gap —
a test asserts every dated fact a summary can emit has a declared horizon. Catching it at runtime
would mean shipping a fact nobody decided the shelf life of.

The head coach therefore never has to *trust* the summary. The summary is self-describing about its
own freshness, and trust is replaced by provenance.

### 3.3 The brief and the decision carry provenance too

- The **brief** carries `computed_at`.
- The **decision** records which brief it was made against.

This is what drift control needs to pin (contract §3.5 rejected agent-written summaries precisely
because there would be nothing to pin). After the fact, *"was this decision made on stale
premises"* is answerable from the artifacts alone.

### 3.4 No re-entrant deciding

Within a run: the head coach decides on the morning's brief, specialists execute and write state,
and the summary would now compute differently. **Re-reading it mid-run is forbidden.** A specialist
that wants more raises a **petition**, mediated on the *next* decision — tomorrow's `plan`, or
today's `adjust.day` if it cannot wait (contract §6.4). Re-deciding on a specialist's request hands
the specialist the whether/what call by the back door.

---

## 4. State versus summary — the derive-don't-store rule

State and summary overlap, and without a rule they converge into the same thing.

- **`state`** is what the domain needs to **operate**: the current working loads, the block's
  position. Written by actions.
- **`summary`** is what the head coach needs to **decide**: a bounded, prose-free, cross-domain
  legible projection, derived at read time from policy + profile + state + history + store.

**⚑ contract choice — the rule:** *if a value can be derived cheaply and deterministically from
canonical sources, it does not go in state.* "Days since the last hard session" is derived, never
stored. State is a cache **only** where the derivation is expensive or the source is gone.

Without it, state accretes convenience fields and becomes `current-status.md` again — the file that
was 52% coaching log and that every session paid for (design §5). And the two are not
interchangeable for the head coach in any case: state is domain-shaped and free-form, so reading it
directly puts domain internals into the head coach's context, which is the thing the summary exists
to prevent.

---

## 5. The progression loop

### 5.1 What was missing

Three records existed and the join between them did not:

- **history** — what was decided.
- **store / logbook** — what happened.
- *(nothing)* — **intent → outcome → verdict**, over a horizon longer than a day.

### 5.2 The weekly review interprets; it does not compute

The review is a **workflow** — an agent, weekly, producing a verdict and possibly proposals. The
adherence and outcome numbers it reads are **deterministic and domain-computed**.

If the join existed only as *"the head coach re-reads four weeks of history and eyeballs it"*, a
strong model would be doing arithmetic, the verdict would differ between two runs on identical
data, and drift control would again have nothing to pin. It would also let a specialist shade its
own performance into the head coach's premises — contract §3.5's third reason.

### 5.3 A windowed `progress` verb, separate from `summary`

**⚑ contract choice.** Adherence over a window is a **separate deterministic verb**, not a widening
of `summary`:

```ts
export type ProgressCommand = (input: { from: IsoDate; to: IsoDate }) => Promise<DomainProgress>;
```

`summary` is on the hot path of every `plan`, every `adjust.day` and every nudge; it must not pay
for four weeks of arithmetic every morning. `progress` is called by the weekly review and by the web
app's trends view, where the cost is warranted and the window is explicit.

`DomainProgress` obeys the same rules as `DomainSummary`: bounded, prose-free, facts not verdicts,
and it degrades to gaps rather than fabricating. Its facts are the ones a domain can compute about
its own delivery — planned versus done, fidelity distribution, drift of an observable against its
policy target.

### 5.4 A shared history envelope, open payload

**⚑ contract choice.** Every history row carries a small required core; everything domain-specific
sits beneath it:

```ts
export interface HistoryEntry {
    readonly at: string;            // ISO, from the run's clock
    readonly kind: string;          // "decision" | "promotion" | domain-defined
    readonly by: string;            // the namespace or party that appended it
    readonly summary: string;       // one line, the same cap as a plan element's `why`
    readonly payload?: Record<string, unknown>;
}
```

This buys *"every decision taken in the past month"* as a scan-and-filter without forcing domains
into a shared shape. One boundary holds: that cross-namespace read is a **core** capability
(`coach query`), never a plugin one — the shared envelope serves core-side query and nothing else.
Since files are canonical and DuckDB is derived (design §5), the natural end state projects this
envelope into a `decisions` table; that is Chunk 4's call, not a prerequisite.

---

## 6. Actions, completion and logging

*Parent: design §7 (the catalogue — `meal.confirm`, `meal.log`, `session.log`), §6 (the plan carries
each module's `actual`).*

A planning session produces, among other things, a list of **actions** the athlete is expected to
perform. Their outcome arrives from the athlete (partial, late, or never) or from hard data
(Garmin). This section fixes who owns what, and how a non-binary outcome is recorded without
lying.

### 6.1 Three states that must never collapse

| State | Meaning |
| --- | --- |
| **`unknown`** | No signal arrived. This is a **gap**, not a skip. |
| **`reported`** | The athlete said something — completed, partial, modified, or skipped. |
| **`observed`** | Hard data says something happened. |

**Never infer `skipped` from silence.** If the athlete goes quiet for six days, the system says *"I
cannot see six days"*, not *"adherence 0%"*. This is `missing ≠ zero` applied to behaviour, and it
is the load-bearing rule of this section: inferred skips are how a coaching system ends up
correcting an athlete for not answering their phone, and how adherence statistics quietly become a
measurement of reporting habits rather than of training.

Where `observed` and `reported` overlap and disagree, **observed wins** for what it can see (the
watch says 8 km), **reported wins** for what observation cannot see (the extra yogurt). Neither is
discarded — both are recorded, and the disagreement is itself a fact.

### 6.2 Ownership

| Concern | Owner |
| --- | --- |
| The action record, its id, its lifecycle, ingesting raw signals from any channel | **core** |
| Interpreting prescribed versus observed → a grade | **plugin**, deterministic |
| The thresholds behind that grade | **policy**, base ⊕ override |
| The grade vocabulary | **core** — shared, so cross-domain queries work |
| Whether it is worth asking the athlete at all | **head coach** |

The athlete-facing "done" goes through **one core channel**; they must never need to know which
plugin owns which action. What a plugin exposes is a deterministic **`reconcile`** verb: given the
prescription and whatever signals arrived, produce

```ts
export interface Reconciliation {
    readonly grade: "completed" | "partial" | "modified" | "skipped" | "unknown";
    /** Where meaningful: 8 of 10 prescribed km → 0.8. Null when the domain cannot quantify it. */
    readonly fidelity: number | null;
    /** What was ACTUALLY done — the input to tomorrow's decision, not just a score. */
    readonly observed: Record<string, unknown>;
    readonly gaps: readonly Gap[];
}
```

`observed` is not optional garnish. A grade alone throws away *"5 km instead of 10, in the
evening"*, which is precisely what the next decision needs.

The one call that stays with the head coach is **whether to ask at all**: it is the only party that
knows the athlete already had three nudges today and that this would be the fourth.

### 6.3 Amend versus report — the before/after distinction

**⚑ contract choice, and the sharpest edge in this document.**

- **Before the fact = an amendment to the plan.** *"Chicken instead of beef"* changes the
  prescription. The domain re-derives (do the macros still hold? compensate at dinner?), the plan
  file records the amendment, and `reconcile` later compares against the **amended** prescription.
- **After the fact = an outcome report.** The plan stands; what happened differed. Grade
  `modified`, and `observed` carries the delta.

Collapsing them breaks the loop in one of two directions, both fatal:

1. Record a pre-meal swap as a **deviation** → the athlete reads as non-compliant for doing exactly
   what the coach would have prescribed.
2. Record a post-meal deviation as an **amendment** → the plan silently rewrites itself to match
   reality, adherence is always 100%, and the plan degrades into a diary with nothing to measure.

Every log entry therefore carries `at` (when it was said) alongside `occurred` (when the thing
happened or will happen), and a `mode` of `amend` or `report`, **defaulted deterministically from
whether the action's window has passed**. No question is asked. Because the log is append-only, a
wrong default is corrected by appending, never by rewriting — which is what makes defaulting
aggressively safe.

### 6.4 Logs are deltas; proposals are whole documents

An asymmetry worth stating, because it is the sort of thing an implementer trips on once:

| | Unit | Why |
| --- | --- | --- |
| **Proposal** (contract §1.11) | the **complete** post-change document | promotion replaces the file wholesale; a partial would silently delete every other override |
| **Log entry** | a **delta** | it appends an event; full state is derivable by replay |

*"No beef, chicken"* must never require restating the meal.

### 6.5 Low friction is a design constraint, not a polish item

Four rules, in priority order:

1. **The prescription is the log.** Marking something done carries zero information — one tap, one
   word, no fields. Only *deviation* costs typing.
2. **The common path uses no agent.** `done` is deterministic. *"Chicken instead of beef"* is a
   cheap parse plus a deterministic macro recompute against the food table and policy thresholds.
   No head coach, no specialist coach. This is what makes it feel instant in Telegram and what keeps
   it affordable at ten logs a day. The head coach is involved only when a deviation crosses a
   threshold the domain cannot absorb — otherwise every meal would cost a mediation.
3. **If hard data can answer it, never ask.** Observation is authoritative where it exists;
   self-report fills the gaps it leaves.
4. **One batched nudge, not N.** A single end-of-day or next-morning prompt covering what is
   unresolved — and only for actions whose signal policy says is worth having. A missed mobility
   session may not warrant a question; a missed key session does.

**Keep the raw utterance beside the parsed delta.** A mis-parse is then recoverable, and the coach
can read what was actually said rather than what a cheap model made of it.

### 6.6 Silence closes as `unknown`, permanently

After a policy-defined window, an unreported action closes as `unknown` and stays that way. It never
converts to `skipped`.

Reporting follows: **`4/6 completed, 2 unknown`**, never `4/6 = 67%`. Folding unknowns into the
denominator contaminates training data with reporting habits, and a coach that adjusts to that
artefact is adjusting to nothing.

---

## 7. Proposal gatekeeping

The athlete is the sole gatekeeper of durable change, and the head coach is the sole route to the
athlete. Contract §1.11 already fixes this: specialist proposes → head coach mediates → rejection
returns it with a reason (bounded rounds) → approval reaches the athlete's gate → core promotes.

**⚑ contract choice — one addition.** A head coach that can kill a proposal outright makes the
athlete blind to what their coaches suggested and what was refused on their behalf. Since
`ProposalRecord.rounds[]` already records every rejection with its reason, rejected proposals **stay
on disk** and the **weekly review surfaces them as a digest** — *"3 proposals raised, 2 rejected,
here is why"* — rather than as interruptions. Accountability without overwhelm.

This is also the boundary that makes evolution predictable, and it is worth naming precisely
because the phrase *"coaches adjust when things are not going to plan"* spans both sides of it:

- **The *how* — the domain adjusts freely.** A different session, different loads, a different meal.
  That is its job, and it needs no gate.
- **The *rules* — the domain only ever proposes.** It cannot change its own policy. Every rule
  change has a proposer, a rationale, a mediator and a signature.

Without that line, a domain quietly rewrites its own thresholds after a bad block and the system's
behaviour drifts with nothing in the record. With it, and with everything person-specific held as
data rather than code, the same logic tree serves a second person predictably.

---

## 8. What this supersedes, and obligations on later chunks

### Superseded

| Where | Was | Now |
| --- | --- | --- |
| contract §1.4 | seven kinds, none for identity | identity is **not** a kind — it is logic, `coaches/<ns>/COACH.md` (§2.1) |
| contract §2.5 | reserved names `core, brief, sync, query, run, resume` | plus **`head`** (§1.2) |
| contract §2.6 | the active set is a profile document | plus **`head` is exempt and always active** (§1.2) |
| contract §3.2 | facts are scalars or small records | dated facts are **`DatedFact`**, carrying `as_of` (§3.2) |
| contract §3.2 | `summary` is the only deterministic digest | plus a windowed **`progress`** verb (§5.3) |
| storage `HistoryEntry` | `{ at, [field]: unknown }` | a required core envelope + open `payload` (§5.4) |
| design §3 | the head coach is core machinery | the head coach is a **plugin** (§1.1) |

### Obligations

| § | Choice | Obligation |
| --- | --- | --- |
| 1.1 | Head coach is a plugin; breadth is input | **Chunk 2** registry entry + reserved key; **Chunk 4** composes the brief as its input; **Chunk 5** hands it `query` as a tool |
| 1.2 | `head` is always active | **Chunk 13** — the profile's plugin selection cannot deselect it; absence is a startup error |
| 1.3 | Head-coach `validate` checks decision structure | **Chunk 5** (head-coach output contract) |
| 2.1 | Identity is logic, single-layer, runner-resolved | **Chunk 5** (runner prompt composition); a test asserts no `Storage` handle exposes it |
| 2.3 | Nothing mechanical lives only in prose | **Chunk 1** content port — `training.md`'s rules land in `policy/head/`, not in a `.md` |
| 3.2 | `DatedFact` + policy staleness horizons | **Chunk 4** (brief); build-time test that every dated fact has a declared horizon |
| 3.3 | Brief `computed_at`; decision records its brief | **Chunk 3** (plan schema) and **Chunk 4** |
| 4 | Derive-don't-store for `state` | **Chunks 5–7**, enforced at review rather than by a type |
| 5.3 | `progress` is a separate windowed verb | **Chunk 7** (plugins) and the weekly-review workflow |
| 5.4 | Shared history envelope | **Chunk 2** (`infra/storage/types.ts`); **Chunk 4** may project it into DuckDB |
| 6.2 | `reconcile` per plugin; core owns the action record and the channel | **Chunk 3** (action ids in the plan schema), **Chunk 7** (per-plugin `reconcile`) |
| 6.3 | `at` / `occurred` / `mode`, defaulted from the action window | **Chunk 3** (schema) and **Chunk 8** (log commands) |
| 6.6 | Unknowns close permanently and report separately | **Chunk 7** (`progress` arithmetic) |
| 7 | Rejected proposals are retained and digested weekly | **Chunk 13** (`decide`) and **Chunk 12** (web app) |
