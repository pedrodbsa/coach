# 14 — Modules, workflows and the profile

Type: grilling
Status: resolved

## Question

Standing decisions 11 and 12 settled the principle: modules are a real boundary, workflows are
compositions over module-contributed actions, and one deployment serves one profile. What
remains is the decomposition itself.

### What are the modules?

A first cut, from the existing protocol stack:

| Module | Policy it owns | Actions it contributes | State it owns |
| --- | --- | --- | --- |
| `running` | `running.md`, the running half of `training.md` | decide the run, HR-zone targets, DSW cross-check, heat rules | — |
| `strength` | the strength half of `training.md`, the movement library | decide the lift, gym filter, load progression | working loads, enum status |
| `nutrition` | `nutrition.md`, `meal-rotation.md` | resolve the tier, re-tune meals, `meal.confirm`, `meal.log` | eaten rows, actuals |
| `skin` | the hypothesis ranking | `skin.capture` | observations |
| `mobility` | `mobility.md` | — | — |
| `supplements` | `supplements.md` | — | — |

Decide whether that is the right cut. Open edges:

- `training.md` covers both running and strength; it may need splitting the way ticket 13
  splits `current-status.md` and `strength-exercises.md`.
- Is `garmin` a module, or an integration that modules depend on? It is device-level rather
  than domain-level, but `garmin.push` is meaningless without `running` or `strength`.
- Do `mobility` and `supplements` earn module status when they contribute no actions, or are
  they policy documents the agent simply reads?
- What is left in the **core** that is not a module — the brief, the gate machinery, the day
  file, the workflow runner?

### Modules partition ownership, not context

One policy document per module works, **provided the modules are read holistically**. Running
policy affects training policy and vice versa: a hard run changes the lift, which changes the
tier. So the agent's decide step receives the union of every active module's policy — module
boundaries govern ownership, composition and configuration, never what the agent is allowed to
see.

That raises a question the table above cannot answer: **where does cross-module policy live?**
Rules like *"on double days, partition carbs so recovery between the run and the PM lift is
protected"* belong to `running × strength × nutrition` and to none of them individually. The
concurrent-training rules are the largest instance. Options: the core owns an interaction
layer; one module owns it by convention; or such rules are what is left in `training.md` once
the running and strength halves are extracted. Decide, because a rule owned by nobody is a rule
that gets dropped when a module is removed.

### How is a workflow declared?

- What does a workflow definition look like, and where does it live — code, a config document,
  or a policy document the athlete can edit?
- How does a workflow degrade when a module it references is absent? The girlfriend case:
  `plan` with no `running` module should not need editing to work, it should just contain
  fewer actions.
- Can a module contribute a **gate**, or only actions? The DSW `needs-input` gate is
  running-specific and should disappear with the module.
- Ordering: if modules contribute actions into a shared workflow, what determines the order?
  Declared priority, explicit dependencies, or a fixed skeleton with named slots?

### What is in a profile?

- Identity, selected modules, per-module policy document paths, state location, integration
  credentials, and the athlete-specific constants that are currently hard-coded in prose
  (HR ceilings, Bod Pod baseline, target weight, gym equipment).
- How much of what reads as "policy" today is actually **profile data**? `current-status.md`'s
  phase timeline and race calendar are Pedro's, not the system's. Ticket 13 splits policy from
  state; this may reveal a third kind.
- Does the profile itself need to be editable from a client, or is it deployment config?

## Context

- Standing decisions 9, 11 and 12 on the map.
- Depends on [13 — Policy/state split](13-policy-state-split.md) landing first, or at least
  being decided in the same session: both are cutting the same documents apart, and doing them
  independently will produce two incompatible seams.
- The behaviour to preserve is in [01 — Action catalogue](01-action-catalogue.md); this ticket
  changes how it is expressed, not what it does.

## Answer

Resolved 2026-07-22, jointly with [13](13-policy-state-split.md).

### The head coach and the specialists

**A master module owns the interactions between specialist modules** — a head coach over
specialist coaches. Specialists own their own domain policy; anything spanning two or more
belongs to the head coach.

The head coach **already exists**: `protocols/coaching.md` is titled *"COACHING PHILOSOPHY -
MASTER"*. It is under-used, and its most important rules are currently misfiled in
`training.md`.

This replaces three more elaborate schemes considered and rejected: lowest-common-ancestor
placement (anything spanning training and nutrition lands in core, so core silently becomes
where the interesting rules live), pairwise interaction documents (n², and the decision tree
spans three modules so it fits no pair), and per-rule ownership by whichever module's output
changes (needs a judgement call per rule). The objection that a master module accumulates all
the interesting rules is **not** an objection — that is precisely a head coach's job. The
mistake was thinking of it as plumbing.

### `training.md` dissolves

| Section | Goes to |
| --- | --- |
| Sleep & Readiness Decision Tree, Override Rules, Cumulative-Load Rules | head coach |
| Weekly Structure, Phase-Aware Weekly Templates | head coach |
| Double-Day Guidelines, Rest-Day NEAT | head coach |
| Minimum-Effective-Dose Fallback Week, Disrupted-Day Protocol | head coach |
| Tracking Rules | head coach |
| Strength Focus, Leg Day, Upper Push, Upper Pull, Arms | `strength` |
| Exercise Rotation Rules, Progression Rules | `strength` |
| Deload Rules | **unresolved** — governs running and strength both, so arguably head coach |

The Sleep and Readiness Decision Tree plus the Cumulative-Load Rules are the largest single
policy block in the system and gate running, strength and nutrition alike. Their being buried
in a file named for one specialist is the clearest symptom of the missing layer.

### Vocabulary is contributed, rules are not

Head-coach rules quantify over terms the active specialists register. *"No more than N hard
sessions in 7 days"* is head-coach policy; what counts as **hard** is registered by whichever
specialists are present — `running` contributes quality and long run, `strength` contributes
heavy legs. Remove a specialist and the vocabulary shrinks while the rule keeps working, with
nothing hand-edited.

The girlfriend case is then trivial: head coach + `strength` + `nutrition`, no `running`.

### Workflows are declared in a document the head coach owns

The `plan` workflow is declared alongside the coaching policy — its steps, and which module
contributes each. Editable without a redeploy, versioned in git, and sitting with the
philosophy that justifies it. Consistent with the standing split: mechanics in code, policy in
documents.

### Proposed module inventory

Decided by derivation rather than put to the athlete — **review this**. The test applied: a
specialist owns domain policy *and* contributes either actions or vocabulary.

| | Verdict | Why |
| --- | --- | --- |
| `running` | specialist | owns policy, contributes actions and vocabulary |
| `strength` | specialist | owns policy, contributes actions and vocabulary |
| `nutrition` | specialist | owns policy, contributes actions and vocabulary |
| `skin` | specialist | owns policy, contributes `skin.capture` |
| `mobility` | specialist | owns policy, contributes pain as a readiness term |
| `supplements` | **not** a module | owns a policy document but contributes no action and no vocabulary — it is policy the head coach reads |
| `garmin` | **not** a module | an integration specialists depend on, not a domain |

### Revision, same day — modules are vertical slices, and some have coaches

The inventory above was corrected and the model extended.

**Corrections.** `supplements` is a characteristic of `nutrition`, not a module of its own.
`garmin` confirmed as an integration, not a module. **Deload Rules go to the head coach**,
resolving the ambiguity left above — they govern running and strength alike.

**A module is a vertical slice, not a policy bundle.** Each owns its data fetch, its derived
context, its policy, its state, and **exposes its own API through the `coach` CLI**. `sleep` is
the clarifying example: today it is scattered across the brief, the readiness tree, a fallback
rule in `training.md` and a recurring theme in the coaching log. As a slice it owns all of
that. Same for `recovery`, `body` and `steps`. This is the brief, properly decomposed, and it
is what makes lean sessions possible — a caller pulls the slice it needs instead of the whole
protocol stack.

**Some modules have a coach; the rule is what versus how.**

> The head coach decides **whether** and **what**. A specialist decides **how**.

The head coach says "quality today" without knowing running methodology; the running coach
turns that into a session. Applied across the inventory:

| Module | Head coach says | Specialist coach? |
| --- | --- | --- |
| `running` | "quality today" | **yes** — selects off the sub-T → threshold → 10K-pace → VO2 ladder, sets reps, paces and HR bands |
| `strength` | "upper push" | **yes** — filters movements by the day's gym, applies rotation and progression, sets loads |
| `nutrition` | "quality day" | **yes** — builds meals from rotation cards, holds protein distribution and the fat floor |
| `mobility` | "include prehab" | probably |
| `sleep` | — | **no** — sleep is never prescribed, so there is no *how* |
| `skin` | — | **no** — daily capture is mechanical; the weekly correlation is interpretive, so head coach |

The rule was tested against the case that killed the alternative. A standalone **sleep coach**
would have reproduced the 2026-07-01 misattribution: a long awake-time on balanced HRV and
normal deep sleep read as training fatigue when it was anxiety about skin and travel. Getting
that right required training load, skin state and life context at once. The rule excludes a
sleep coach for the right reason — interpretation is a whether/what question and belongs to the
head coach; only *how* delegates.

**Context bounding.** A specialist loads its own module's policy plus the head coach's decision
plus its own state and history. The head coach never loads `running.md`'s workout-type
catalogue or HR-zone tables; the running coach never loads nutrition. That is the leanness win
on the reasoning side, without re-introducing the interdependence bug.

**Ordering is not free.** Specialists are not simply parallel: `nutrition` must run **after**
`running` and `strength`, because fuelling depends on the session's duration and intensity.
That is a concrete instance of the ordering question below, and it means the workflow document
has to express inter-specialist dependencies.

**Cost, resolved.** The concern that several calls beat one was answered by making **model and
effort a per-step declaration** in the workflow document: the head coach's holistic judgement
warrants a strong model, assembling a meal to hit a macro target does not. Several small calls
on cheap models can beat one large call carrying the whole protocol stack. Latency still
compounds, and that remains worth measuring.

What makes the downgrade safe is a **deterministic validator** per specialist whose output is
mechanically checkable — `coach nutrition validate` confirming macros, three protein boluses
over 30 g and the fat floor; `coach running validate` confirming every step carries an HR or
pace target, which is the same check [02](02-plan-schema.md) already requires for
`garmin.push`. A failed validation re-runs or escalates. The cheap model's output is checked
rather than trusted.

**Not a solver, though.** Meal assembly resembles constraint satisfaction closely enough to
tempt, but its constraints are prose that changes — fruit after lunch for craving control, iso
with the fattiest meal, eggs in counts never grams, the snack funded by a smaller breakfast.
Encoding those into a solver freezes policy into code and needs a deploy to change what he
eats, which is what decision 10 exists to prevent. See map decisions 21 and 22.

### Modules are autonomous policy-owners (added 2026-07-23, map decision 30)

A module does not merely *hold* policy the head coach reads — it **owns and evolves** it. The
head↔sub relationship is the same shape at two timescales: daily, the head coach decides what
and the sub-coach decides how; for policy, the head coach sets direction and the sub-coach
proposes domain-specific policy changes, which the head coach (with the athlete) reviews and
mediates for cohesion. The head coach never authors domain policy and never loads a domain's
internals — that is what keeps its context lean.

This resolves the **working-loads** question left open in [13](13-policy-state-split.md) and
[02](02-plan-schema.md): loads and progression rules are strength-coach-owned, and the strength
coach proposes the bumps through `decide`. The storage format (document versus store) is still
open; the ownership is not.

It also sharpens the specialist test. A module warrants a coach if it has *how* to decide daily
**or** domain policy to evolve. `mobility` on that basis probably does warrant one after all —
it evolves prehab policy — which softens the "probably" left below.

### A module is a plugin (added 2026-07-23, map decisions 32–34)

The module abstraction is a **plugin: a self-contained life area**. Its contract:

- owns its **data** (its own namespace, reads only its own), **policy** and **state**;
- may have a **coach** (warrants one if it has a *how* to decide daily or domain policy to
  evolve);
- exposes a `coach <domain> …` **CLI namespace**, including a deterministic `summary` the head
  coach reads instead of raw domain data;
- declares its **dependencies** (the `depends_on` of [02](02-plan-schema.md));
- can **petition** other domains through the head coach.

The bar: the contract must be clean enough that a future plugin — cycling, household, social
life — slots in without touching the core. Non-quantitative domains will stress it (no Garmin
feed, no numeric validator); v1 need only avoid precluding them.

**Cross-domain petitions.** Domains influence each other two ways: implicitly through
`depends_on`, and explicitly by petitioning the head coach — the running coach asking for
posterior-chain strength work. The petition is a **capability or priority**, never domain
internals, so the head coach mediates without needing the petitioning domain's specifics.

**Data segregation.** Logical, over shared infrastructure — each domain owns its data
namespace; the head coach reads deterministic per-domain summaries; the Garmin raw store sits
at integration level beneath the domains. See map decision 34.

### Left open — now closed (2026-07-23)

- ~~Whether the profile is editable from a client or is deployment configuration.~~ → **map
  decision 49**: web app (and terminal), governed path, not Telegram; initial creation is a
  bootstrap.
- ~~Ordering and dependency declaration between specialists.~~ → **map decision 50**: derived
  from `depends_on`, topologically sorted at composition into the n8n workflow.
- The plugin contract deserves its own written specification — carried into the spec draft as a
  named section, since it is load-bearing for extensibility. Not a blocking decision.
- Whether `mobility` warrants a coach is a minor per-plugin call, safe to settle when `mobility`
  is built; the plugin contract accommodates either.
