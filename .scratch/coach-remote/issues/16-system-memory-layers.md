# 16 — System memory: daily, weekly, global

Type: grilling
Status: resolved

## Question

Agent sessions need enough context to reason well and little enough to stay lean. The proposal
is three layers of persistent system memory — **daily**, **weekly**, **global** — assembled
into a session's starting context.

This is distinct from the brief. A brief is per-invocation, derived, thrown away. Memory
persists, compounds, and is what a session reads before it reads anything else.

Decide:

### What is in each layer

- **Daily** — today's plan, actuals so far, this morning's markers, open gates. Roughly what
  the journal holds today.
- **Weekly** — the week's shape, what was prescribed against delivered, trends that only make
  sense across days, unresolved flags.
- **Global** — the profile, standing constraints, and the durable coaching lessons that
  currently live scattered across `current-status.md`'s coaching log, `AGENTS.md`'s primer,
  and the auto-memory index.

Get the boundaries right by asking what breaks if a layer is missing, rather than by
classifying what exists.

### Who writes each, and when

- Daily is written continuously by the workflows.
- Weekly implies a rollup — which is the `/week` effort, out of scope for this map. Decide
  what this map must specify so `/week` has somewhere to write, without specifying `/week`.
- Global changes rarely and deliberately. Does an agent ever write it, or only the athlete?

### Promotion and eviction

The layers only stay lean if things leave them. What graduates daily → weekly → global, what
is summarised, and what is dropped entirely? A memory system with no eviction is just a longer
file.

This overlaps [10 — Journal boundary](10-journal-boundary.md) directly: the question there is
what stays prose, what graduates to the coaching log, and what stops being written. That *is*
promotion, seen from one layer. Resolve them consistently or together.

### Assembly

- What does a session actually load — all three layers, or a selection by workflow?
- Does the profile or the active module set change what is loaded?
- **Memory is now per-slice, not global.** Decisions 19 and 20 make each module a vertical
  slice owning its own context, and give some of them their own coach with a bounded view: a
  specialist loads its own policy, the head coach's decision, and its own state and history. So
  the three layers are not one stack — each module has its own daily/weekly/global, and the
  head coach has its own. Decide whether that is genuinely per-module or whether the layers are
  shared with per-module *views* over them.
- **`history` is already a settled kind.** [13](13-policy-state-split.md) established policy /
  profile / state / history as four kinds with different lifecycles. History *is* the global
  layer, so this ticket inherits it rather than inventing it — what remains is eviction.
- How does this relate to `AGENTS.md` and `CLAUDE.md`, which are loaded by the Claude Code
  preset today and carry a long coaching primer written for the old shape?

## Context

- Prompted by the observation that sessions must stay lean while still having enough context.
- Interacts with [08 — coach CLI/SDK surface](08-coach-cli-surface.md) (the brief is the
  transient layer beneath this) and [10 — Journal boundary](10-journal-boundary.md).
- The `/week` effort owns the weekly rollup itself; this ticket owns only the contract it
  writes into.

## Answer

Resolved 2026-07-23, jointly with [10 — Journal boundary](10-journal-boundary.md).

### The layers are already-existing kinds, not a new invention

[13](13-policy-state-split.md) established four kinds. Three of them *are* the memory layers:

| Layer | Is | Written by | Loaded? |
| --- | --- | --- | --- |
| **Global / long-term** | the **coaching log** (history) + **policy** + **profile** | the `decide` workflow (log/policy/profile), the athlete (policy/profile) | yes — the durable base of every session |
| **Weekly** | the current-status **state** snapshot + the week file | the weekly rollup (the `/week` effort) | yes |
| **Daily** | today's **plan document** + today's **journal** | the workflows | plan yes; journal no |
| **(transient)** | the **brief** | code, per invocation | yes, then discarded |

So this ticket did not need to invent a memory system. It needed to notice that policy, profile
and the coaching log already are the global layer, that state is the weekly layer, and that the
plan document is the daily layer. The brief sits beneath all of them, transient.

### The coaching log is the right shape already

`current-status.md`'s Coaching Log is a bounded `Date | Decision | Rationale` table. The format
is not the problem. The problem is that recent *reasoning* grew into `####` essays inside daily
files while the log stayed thin — so the durable record is thinner than what actually happened.
Fixed by [10](10-journal-boundary.md): a day's reasoning graduates to a bounded log row through
`decide`, and the essay stays behind in the journal, linked.

### Eviction, for free

The leanness win comes from **loading decisions, not derivations**. A session loads coaching-log
rows (bounded), current policy and profile, and the transient brief. It never loads the
journals the rows link to. So the loaded context does not grow with the number of days — it
grows only with the number of *durable decisions*, far slower, and each of those is one line.
That is the eviction mechanism the ticket asked for: derivations are evicted from load by
construction, not by a summarisation pass.

Whether the coaching log itself eventually needs compaction (a decision from March that has
since been superseded) is a real but slow problem — deferred, because it is a year-scale
concern and superseded rows can be marked rather than deleted.

### Per-module memory

[19](14-modules-and-profile.md) makes each module a vertical slice, so the layering is
per-slice, not one global stack:

- Each module owns its slice of the coaching log (nutrition decisions, running decisions), its
  own policy and profile, and its own state.
- A **specialist** loads its own slice plus the head coach's decision plus its declared
  dependencies ([02](02-plan-schema.md), decision 26) — not the whole log.
- The **head coach** loads across slices, because being holistic is its job.

This is the same boundary decision 26 drew for the plan document, applied to memory: what a
coach *reads* is scoped by module, what it *is responsible for* is not.

### `AGENTS.md` / `CLAUDE.md`

These are loaded by the Claude Code preset and carry a long coaching primer written for the old
shape. Under this model the primer is **global-layer policy that belongs to the head coach**,
not preamble baked into every session's system prompt. Rehoming it is work for
[12 — Command doc rewrite](12-command-doc-rewrite.md); the point here is only that it is one
more thing that should load as scoped policy rather than as an always-on prefix.
