# Remote Coach — v1 Design

**Date:** 2026-07-23
**Status:** Decision-complete design, ready for implementation planning
**Supersedes:** `2026-06-19-coach-remote-interface-design.md` (substantially — see "What changed")
**Source of record:** this document. The wayfinder map at `.scratch/coach-remote/` (16 design
tickets, 50 numbered decisions) is the brainstorm working material this spec was synthesised
from — historical background, not authority. Inline decision/ticket citations are provenance
pointers only; where the map and this document disagree, this document wins.

---

## 1. Problem and goal

The coaching system works but is chained to the desktop. Reading the day's plan, logging meals
and sessions, and conversing with the coach to adjust the day all require sitting at a computer
with Claude Code open — and the athlete is usually away from it when those needs arise (gym,
kitchen, out running).

The goal is a **hosted coach reachable from anywhere**, not a file-access surface. The athlete
never hand-edits protocol or logbook files; those are the coach's medium. What is needed is a
conversation-and-reading surface, plus the ability to steer the coaching rules over time.

This design also fixes a class of error the desktop workflow was prone to: the morning `/plan`
re-derived numbers like ACWR in prose every day with nothing verifying them (the 2026-06-24
miss). Moving the deterministic work into tested code is part of v1, not a later cleanup.

### v1 scope

The remote surface **plus** the brief/data layer. The `/week` redesign (weekly recap + next-week
draft) is a **separate effort**, out of scope here.

### This is a greenfield build in a new repo

The new system lives in a **new repository**. The current `routine` repo is only a **content
source** — its `protocols/*.md` and `logbook/` are ported into the new structure. Nothing about
the current repo's layout constrains the design.

---

## 2. Architecture at a glance

Two layers, cleanly separated:

- **The engine** — a bespoke **TypeScript `coach` library**, exposed as a **CLI**. It holds all
  domain logic: agent orchestration (via the Claude Agent SDK), the plan schema, validators,
  lookups, the brief, Garmin writes.
- **The driver** — **n8n**. It hosts per-profile workflows, handles Telegram I/O, cron triggers,
  the HTTP API for the web app, durable human-in-the-loop waits, and execution logging.

```
 ┌─────────── clients ───────────┐
 Telegram         Web app (Tailscale)      Terminal / ad-hoc Claude Code
    │                    │                          │
    └──── n8n ───────────┘                          │  (bypasses n8n)
           │  (Telegram node, HTTP API,             │
           │   cron, Wait-node gates)               │
           ▼                                        ▼
      ┌──────────────────  coach CLI  (the one interface)  ──────────────────┐
      │  deterministic ops: brief · lookups · validate · summary · writes     │
      │  agent ops: run <coach>  → Claude Agent SDK (Claude Code)             │
      └──────────────────────────────────────────────────────────────────────┘
           │                    │                         │
     per-profile DuckDB    git files (canonical)     Garmin MCP (workout writes)
     (state + Garmin,      protocols/profile/          garmin-cli → DuckDB (reads)
      one per profile)     logbook, per profile)
```

**The CLI is the single canonical interface.** n8n nodes exec it, the agent calls it via its
`Bash` tool, the terminal and ad-hoc Claude Code sessions run it directly. This keeps n8n a
*replaceable driver* — swap it and the engine is untouched — and makes "drive the whole system
from a Claude Code session" a native capability. *(Decisions 42, 44.)*

---

## 3. The coaching model: head coach and specialists

The coaching brain is a **multi-agent** system, not one big session.

- The **head coach** decides **whether** and **what** — the holistic, high-level call: readiness
  verdict, day type, which sessions to prescribe, which rules fired. It never holds a domain's
  internals, which is what keeps its context lean. *(Decisions 17, 20.)*
- A **specialist coach** decides **how** — the head coach says "quality today"; the running coach
  turns that into a session (paces, HR bands, reps). *(Decision 20.)*

Not every domain has a coach: one exists where there is a *how* to decide daily or domain policy
to evolve. `running`, `strength`, `nutrition` (and probably `mobility`) have coaches; `sleep` and
`skin` do not, because nothing about them is *prescribed* — interpretation is a whether/what
judgement and stays with the head coach. This is what stops a narrow "sleep coach" reproducing
the 2026-07-01 misattribution (a bad night on balanced HRV read as training fatigue rather than
anxiety). *(Decision 20.)*

Specialists are not simply parallel: `nutrition` runs **after** `running` and `strength`, because
fuelling depends on the session's duration and intensity. *(Decision 20.)*

### Model and effort per step; validators make cheap models safe

Model and effort are declared **per workflow step**, tunable without a deploy. The head coach's
holistic judgement warrants a strong model; assembling a meal to a macro target does not. A
downgraded specialist is made safe by a **deterministic validator** — its output is checked, not
trusted. Do **not** replace a cheap specialist with a solver: its constraints are prose that
changes (fruit after lunch, iso with the fattiest meal, eggs in counts not grams), and a solver
freezes policy into code. Cheap model **plus** validator. *(Decisions 21, 22.)*

---

## 4. Plugins (domains) and the profile

### A plugin is a self-contained life area

A module **is a plugin**: a vertical slice that owns its **data**, **policy** and **state**; may
have a **coach**; exposes a `coach <domain> …` CLI namespace including a deterministic
`summary`; declares its **dependencies**; and can **petition** other domains through the head
coach. The bar: the contract must be clean enough that a future plugin — cycling, household,
social life — slots in without touching the core. *(Decisions 19, 32.)*

v1 plugins: `running`, `strength`, `nutrition`, `skin`, `mobility`. `supplements` folds into
`nutrition`. `garmin` is an **integration**, not a plugin. *(Decision 14 answer.)*

### The head coach mediates

Cross-domain influence is **mediated and phrased in head-coach terms**. The running coach may
petition "the athlete needs posterior-chain strength work" — a *capability/priority*, never
domain internals ("do RDLs at 80 kg"). The head coach mediates the priority; the target
specialist still owns the *how*. This is what lets domains genuinely affect each other while the
head coach stays lean. *(Decision 33.)* The head coach is the existing `coaching.md` — the
"master" that owns the cross-specialist interaction rules (the readiness tree, the
Cumulative-Load Rules, double-day fuelling). Head-coach rules **quantify over vocabulary the
active specialists register**, so removing a specialist shrinks the vocabulary rather than
breaking the rule. *(Decision 17.)*

### The profile

One deployment can serve several people; a **profile** selects plugins, points at its own policy
documents and overrides, and owns its state and its own DuckDB, all under `data/<profile>/`.
Profiles share one n8n instance; **isolation is software-enforced** — every core operation takes
a profile and scopes strictly to `data/<profile>/`, and **must never cross**. This is a hard
invariant (the shared n8n process is a softer boundary than separate containers). *(Decisions
12, 34.)*

---

## 5. Data model: four kinds

Coaching data is **four kinds**, not one directory. Policy and profile are **read-only to
actions**; state and history are what actions write. This is what makes "no policy edits from
Telegram" mechanically enforceable rather than a per-message judgement. *(Decisions 16, 13.)*

| Kind | Written by | Lifecycle | Example |
| --- | --- | --- | --- |
| **Policy** | the athlete, via `decide` | edited, rarely | Cumulative-Load Rules, meal-distribution, workout types |
| **Profile** | the athlete, via `decide`/setup | edited | HR zones, race calendar, goals, gym equipment |
| **State** | actions (via the CLI) | overwritten | metrics snapshot, working loads, weight |
| **History** | actions (via `decide`) | appended, evicted | the coaching log |

Splitting these dissolves live problems in the current stack: the race schedule exists twice and
has already drifted; the Coaching Log is 52% of `current-status.md` and every session pays for
it. `current-status.md` splits four ways; `strength-exercises.md` splits **by column** (movement
library = policy/plugin data; loads + dates = store state); `running.md` mixes policy with
profile. `training.md` **dissolves** — its readiness and Cumulative-Load rules were the biggest
policy block in the system, misfiled under one specialist's name; they move to the head coach.
*(Decisions 13, 14 answer.)*

### Defaults versus overrides

A plugin ships **default** policy in the shared logic (builder-authored). A person's **overrides**
live under `data/<profile>/` (`decide`-mutable). Effective policy = defaults + overrides, so
authoring and steering never touch the same file. This is also how a new person starts: pick
plugins, take defaults, accumulate overrides. *(Decisions 05 answer, 36.)*

### Working loads live in the store

Load × reps × date is quantitative dated **state** → the per-profile DuckDB, written by
`session.log`. The progression *judgement* ("push reps to 12 before loading") is **not** stored
prose — it is the strength coach's policy applied at plan time to the rep-history the store
holds. *(Decision 48.)*

### Files canonical, DuckDB derived; one DB per profile

Documents (policy, profile, the prose of daily logs) are **files in git — canonical**. Structured
quantitative metrics are **DuckDB — derived and queryable**, one store per profile for data
isolation, keyed by date. The daily file carries its required fields as a machine-readable block;
an extractor projects them into DuckDB, so the DB is rebuildable from git at any time. *(Decisions
34, 48.)*

---

## 6. The daily artifact: structured plan + journal

The day splits in two, so the athlete never reads the agent's reasoning to find the workout.
*(Decision 8.)*

### The structured plan (`data/<profile>/…/<date>.plan.yaml`)

**Partitioned by module** — each block owns its plan, its validators and its actuals; the head
coach and the brief sit at root. Validators live inside the module they check. *(Decision 25.)*
The prototype is `.scratch/coach-remote/prototypes/2026-07-22.plan.yaml`.

- `decision` (head coach) — day type, readiness verdict, rules fired, and what each module is
  asked to produce, with a per-module `depends_on`.
- `markers` (brief, code) — sleep, HRV, RHR, body battery, stress. Facts, never verdicts.
- `running` / `strength` / `nutrition` (specialists) — each with its `session`/`meals`,
  `validate`, and `actual`.

Rules for the schema:

- **A one-line `why` per element, hidden by default** — the UI shows the *what*, reveals the
  *why* on tap. The one-sentence cap is what stops the reasoning essays regrowing. *(Decision 23.)*
- **The CLI is the only writer.** Specialists emit structured **JSON** (their output contract);
  the CLI validates and persists **YAML** — on-disk format chosen for the athlete and for git
  diffs. `meal.confirm` is `coach nutrition confirm breakfast`, not an agent editing YAML.
  *(Decision 24.)*
- **Every run step carries an explicit HR/pace target and every movement a resolved load** plus
  its Garmin enum — so `garmin.push` needs no agent step and can chain off approval. *(Decisions
  02, 01.)*
- Some content stays a note, not a field: conditional progressions ("if set 1 flies, go 115 kg")
  and coaching intent ("hold HR, read pace"). Reps have three shapes (per-set list, range,
  per-side) — the schema must carry all three.

### The journal (prose) and the coaching log

A day's reasoning has three fates: **ephemeral** (stays in the journal, never re-loaded, kept for
audit), **a durable decision** (graduates to a bounded coaching-log row via `decide`), or **a
structured field** (already in the plan). The `####` essay is a *derivation*; the decision is the
*artifact*. Sessions **load decisions, never derivations** — so context grows with the number of
durable decisions (one line each), not the number of days. That is eviction for free. *(Decisions
10 answer, 27.)*

---

## 7. Actions and workflows

An **action** is a unit of work (deterministic or agent-driven); a **workflow** is an ordered
composition of actions, gates and chains. Workflows are **composed once** (at setup or when the
profile's plugins change) into a materialised per-profile n8n workflow; step order is derived from
`depends_on`, topologically sorted. Dynamism inside a run comes from reasoning steps returning a
branch key. *(Decisions 9, 14, 50.)*

### The catalogue

Eight athlete-facing actions plus the `decide` workflow. *(Decision 01.)*

| Action | Shape | Notes |
| --- | --- | --- |
| **plan** | `det` preflight → `gate?` (DSW) → `agent` decide → `det` lookups → `agent` summary → `gate` approve → `det` write | judgement comes first; chains to `garmin.push` on approval |
| **garmin.push** | `det` only | no agent step; safe to fire on approval |
| **meal.confirm** | `det` | tap "ate as planned" |
| **meal.log** | `det` → `agent` re-tune → `det` | describe a change; holds the tier |
| **session.log** | `det`/`agent` (Garmin or described) → `agent` flags → `det` | |
| **adjust.day** | `det` → `agent` head coach weighs the input (may change nothing) → specialist knock-ons → `det`; **no gate** — applies, reports the diff, offers undo | ad-hoc input to the head coach; propagation is symmetric — apply re-pushes the watch if the workout changed, and **undo re-pushes the previous workout** |
| **skin.capture** | `det` verbatim → `agent` tag → `det` | |
| **coach.chat** | `agent` free conversation with the head coach | the escape hatch when no command fits; its **only side-effect channel is invoking the other actions** (`adjust.day`, `session.log`, a `decide` proposal) — it never writes directly, so the write model holds |
| **decide** | propose (sub-coach) → mediate (head coach) → approve (athlete) → atomic write | policy/profile/log changes; web + terminal only |

`/body` is **not** an action — it becomes a view (the scale + external Withings→Garmin job supply
weight). *(Decision 01.)*

### Gates: one concept, two execution modes

A gate ("pause for a human decision") is **async and durable** when driven remotely — an **n8n
Wait node**, opened by cron or a client, delivered as a Telegram message with buttons or a web
form, and **resumed by a webhook** any answering surface posts (a Telegram callback, a web form,
or a thin `coach resume` from the terminal). It is **synchronous/interactive** when run
terminal-direct. The CLI returns a structured "awaiting-decision" result either way. This is how
"draft on the web app, approve from Telegram an hour later" works. *(Decisions 41, 45.)*

### Chaining

Actions declare successors: `plan`'s approval fires `garmin.push` without a second tap;
`adjust.day` marks the watch stale and re-fires the push when the workout changed. *(Decision 01.)*

### Durable changes: the `decide` workflow

Policy, profile and coaching-log changes are **not actions** (those are read-only to policy). A
durable change is a three-party workflow: a **sub-coach** proposes with its derivation, the **head
coach** mediates cohesion across domains, the **athlete** approves, and the CLI **atomically**
appends the log row and applies the edit. Web app and terminal only, never Telegram. Cadence is
**weekly by default** (with the recap, the out-of-scope `/week` effort's job), with an **ad-hoc
escape** for the rare urgent correction (a discovered measurement artifact must not wait for
Sunday). *(Decisions 29, 30, 31.)*

---

## 8. The `coach` CLI (the engine's interface)

The core TS library behind a single canonical CLI. *(Decisions 42, 43, 08.)*

- **Namespaced by plugin:** `coach <domain> <verb>` (`nutrition tier`, `strength slice`,
  `running targets`) plus a small core namespace (`brief`, `sync`, `query`, `run <coach>`,
  `resume`). An absent plugin is an absent namespace.
- **Agent commands wrap the SDK:** `coach run <coach> --profile=… --date=… --resume=<sid>` issues
  the Agent SDK `query({...})` and returns structured JSON. Deterministic commands are pure code.
- **Reads:** the two-phase brief (markers/history pre-built) plus named lookups called *after* the
  agent decides; `coach query` is the raw-SQL escape hatch over the profile DuckDB.
- **Output:** structured JSON. **Missing ≠ zero** — a missing value is `null` **plus a first-class
  `gap`** `{field, reason, action}` (e.g. an empty DSW endpoint emits a gap telling the agent to
  ask, never a silent skip).
- **Sync-then-query:** every data command force-syncs first; a failed sync is a **loud gap** that
  switches that read to the Garmin MCP fallback, never a silent proceed on stale data.
- **Validators:** `coach <domain> validate` → `{ ok, violations:[{rule, expected, actual,
  severity}] }`, severity **hard**/**warn**. On a hard failure the **workflow runner** re-runs
  once, then **escalates to a stronger model**, then **surfaces as a `needs-input` gate**.
  Thresholds are read from policy, so changing a floor changes the check with no code change.
- **Summary:** `coach <domain> summary` is deterministic — the compact per-domain digest the head
  coach reads instead of raw domain data; its brief is the concatenation of active plugins'
  summaries.
- **Drift control:** the CLI owns arithmetic, policy owns thresholds; the CLI's definitions are
  unit-tested against fixtures derived from the protocol text, and a `schema_version` pin makes a
  mismatch a hard failure.

Command docs stop being recipes. Each old `.claude/commands/*.md` **decomposes**: orchestration →
n8n workflow; mechanical steps → CLI; coaching judgement → plugin policy; athlete numbers →
profile/overrides. The recomputation trap ("read the brief" beside "compute ACWR") is
*structurally* prevented — the agent has no compute step to leave in. `AGENTS.md`'s primer becomes
scoped head-coach policy, not a session prefix. *(Decision 12.)*

---

## 9. Sessions and memory

- **Memory layers = the four kinds.** Global/long-term = the coaching log + policy + profile;
  weekly = the state snapshot; daily = the plan (loaded) + journal (not); the brief is the
  transient layer beneath. Memory is **per-plugin**: a specialist loads its own slice + the head
  coach's decision + its declared dependencies; the head coach loads across slices. *(Decisions
  16, 26, 28.)*
- **Session model is per-operation.** The Agent SDK is not different in kind from a normal Claude
  Code session. **Continuous session** (sessionId, cached) for iterative work — the chat/adjust
  loop, `decide`/protocol refinement, multi-turn adjustment. **One-shot isolated** for
  self-contained transforms (an ingredient swap). There is **no efficiency penalty for
  continuity** — a resumed session hits the same Anthropic-side prompt cache a live one does; the
  only caveat (cache re-warms after idling past the TTL) applies to any idle session. *(Decision
  47.)*
- Continuity is **same-day / per-conversation, resets across days** — long-term memory is the
  files. Even within a session the coach re-reads files/brief for authoritative state, so a long
  thread cannot drift. The SDK session store lives on the per-profile volume, isolated per
  profile. *(Decision 47.)*

---

## 10. Clients

Three clients, differing in **affordance, not capability**. Routing: Telegram and the web app go
through **n8n → CLI**; the terminal hits the CLI **directly** (works even if n8n is down).
*(Decisions 4, 46.)*

### Telegram — present-tense

Public webhook (secret-token + `chat_id` allowlist), **chat + inline buttons + push**. Scoped to
today's plan (approve/adjust), logging, and a few skills — **not** historical data or
configuration. The **Mini App is dropped** from v1: Telegram is chat + inline buttons only.
*(Decisions 37, 40.)*

### Web app — the backoffice

**Tailscale-only** (Tailscale is the auth; no auth build). The control center, a data-dense
instrument panel, with sections mirroring the four kinds:

- **Today** — the plan, glance-first: workout and food answerable at a glance, readiness markers
  and trailing load on the first screen, reasoning behind a tap. *(Decision 38.)*
- **History** — **trends-first** (weight, load, adherence as simple charts over the store), with
  day drill-down beneath. The elaborate interactive dashboard stays v2. *(Decision 39.)*
- **Protocols** — read policy, and `decide` steering.
- **Profile** — goals, races, HR zones, equipment, edited via the governed path. *(Decision 49.)*

### Terminal — builder and raw client

Runs the CLI directly. The builder writes logic; as a coach it drives the same CLI as any client.
*(Decision 05.)*

### Access, sensitivity, isolation

The **only public surface is the Telegram webhook**; the "someone else's computer" case is served
by Telegram chat in any browser. The Telegram/web split is by **affordance, not secrecy** — the
athlete's chat is private to him and his own numbers in it are fine; what lives only in the web
app does so because it needs dense rendering. The one enforced data boundary is **profile
isolation** — a profile's surfaces show only that profile's data. *(Decisions 37, 46.)*

The affordance matrix: every action on every client **except `decide`** (Telegram-unavailable);
Telegram degrades *rendering*, not *function*; history and trends are web-only views.
Full matrix in `.scratch/coach-remote/issues/09-client-affordance-matrix.md`.

---

## 11. Runtime and billing

**Runtime is the Claude Agent SDK** — the multi-agent, per-step-model design needs its
programmatic `query({ model, systemPrompt, mcpServers, allowedTools })`. **Auth is a swappable
credential defaulting to subscription login.** A first-party support article confirms the SDK runs
on a Pro/Max subscription (subscription login, not an API key), so there is **no forced API
pricing**: currently it draws the shared subscription pool; the designed model gives a dedicated
monthly Agent-SDK credit ($100 on Max 5x) that overflows to API rates only if usage credits are
opted into. Do **not** opt into usage credits unless a hard spend cap is wanted. An API key stays
a one-line swap for hard isolation. *(Decisions 35, 44.)*

Build-time checks: confirm a driver exec'ing our SDK-wrapping CLI is fine under subscription terms
(first-person, single-user — expected fine); measure real cost with
`claude -p --output-format json | jq '.total_cost_usd'` over a day (the API fallback estimate is
~$46–77/month, at or below Max 5x). *(Ticket 03.)*

---

## 12. Garmin access

**Reads → `garmin-cli` → per-profile DuckDB/Parquet. Writes → the Garmin MCP** (structured
workout create/schedule/upload, the entire write surface). Body/weight is **not** pushed — an
external Withings→Garmin job supplies it; `/body` reads only. *(Original split, decision 15.)*

`garmin-cli` is `vicentereig/garmin-cli` (MIT, real, source path confirmed). Two corrections to
the old spec: auth is a **terminal** login (not browser SSO) and survives unattended (sync
refreshes its own OAuth2); `speed`/`power` **are** populated in-schema but Garmin's export carries
no speed for this device, so outdoor splits use **haversine over lat/lon** (for a different reason
than the old spec gave). It is adopted as a **replaceable optimisation layer** — the Parquet store
is committed to git and DuckDB reads it directly, so the *data* depends on nothing; only ingestion
does. Risks are organisational (bus factor of one; Garmin broke auth six times in five weeks), so:
pin the `garmin-cli` version and the container base image together, and make a failed sync loud.
*(Ticket 04.)*

---

## 13. Repository, deployment, state

### One repo, per-profile data

One repo. Shared **logic** (relay/nodes, the `coach` CLI, plugin implementations, workflow
definitions, plugin **default** policy) is terminal-authoritative and deployed. Each person's
`data/<profile>/` (policy **overrides**, profile, state, history, logbook, store) is
server-authoritative, written only by the CLI/workflows, committed per-change. Write authority is
**path-disjoint** — the server writes only `data/<profile>/`, the terminal only logic paths — so
their commits never conflict, and hand-edited coaching content (the divergence bug) stops
existing. *(Decisions 05, 36.)*

### The three state stores

| State | Store | Git | If lost |
| --- | --- | --- | --- |
| Coaching record (plans, logs, overrides) | files under `data/<profile>/` | committed, canonical | nothing lost |
| Quantitative history | per-profile DuckDB | daily snapshot | rebuilt from Garmin + extractor |
| Workflow instance + gates | n8n's execution store | not committed | re-run a workflow |

The coaching *record* is durable and canonical; the workflow *machinery* (n8n) and the SDK session
store are ephemeral operational state on the volume. *(Decisions 41, 47.)*

### Container and orchestration

The whole orchestration stack is **bespoke TypeScript** with n8n as the driver; external processes
exist only where unavoidable (the Rust `garmin-cli` binary, the Python Garmin MCP) and are
*called*, never *orchestrated through*. n8n custom nodes **exec the CLI** (they do not import the
library), keeping the CLI the one interface. The container carries n8n + the `coach` CLI (embedding
the SDK) + `garmin-cli` + the Garmin MCP (python/`uv`) + the DuckDB client. *(Decisions 42, 44.)*

### Scheduled jobs (n8n cron configuration is part of deployment)

n8n owns the clock. Deployment is not complete until its cron set is configured and verified:

- **Daily Garmin sync** (`garmin-cli` → per-profile DuckDB/Parquet), per profile.
- **Daily DuckDB snapshot** (the §5 rebuild guarantee's cheap path).
- **Parquet-store git commit** — the commit cadence that makes `garmin-cli` a losable
  optimisation layer (decision 15 depends on this job existing).
- **Morning nudge** trigger ("weigh-in + sync landed — plan now?"), per §15 tuning.

`/plan` itself stays manual — cron nudges, it never plans.

### Prerequisites (ticket 07 — the athlete's build task)

- A **private git remote** (none configured), with a scoped push credential.
- **Telegram bot** registration: token, webhook secret token, allowlisted `chat_id`.
- **Tailscale** for the web app.
- **Move the Garmin password out of the committed `.mcp.json`** into a secret — prerequisite #0.
- Pin `garmin-cli` + base image together; do the one-time terminal Garmin login.

---

## 14. Out of scope (v1)

- **`/week`** — weekly recap + next-week draft, `CONFIRMED`/`ASSUMED` tagging, the Sunday ritual.
  Its own effort; the primary caller of the `decide` workflow this spec defines.
- Charts/trends **dashboard** (the *minimal* trends view ships in v1; the elaborate interactive
  dashboard does not).
- **Per-set strength analytics.** v1 **does** log per-movement load × reps × date via
  `session.log` — each sub-coach maintains the data it needs, and this is the strength coach's
  progression input. What stays v2 is set-by-set analysis and reporting on top of it.
- Monthly reports as queries; history/full-text search; PWA web-push.

---

## 15. Open at build time (not blocking)

- **Notification triggers** — a "weigh-in + sync landed, plan now?" nudge is worth pushing; the
  full trigger set and what counts as noise is n8n-trigger tuning.
- **Whether `mobility` warrants a coach** — a minor per-plugin call, settled when it is built.
- **The plugin contract** deserves its own written specification — it is load-bearing for
  extensibility; drafting it is the natural next document.
- **Verify** at build: exact SDK session API and prompt-cache TTL/pricing (claude-api docs);
  the subscription-terms check above.

---

## What changed from the 2026-06-19 spec

The earlier spec described a **read-only phone companion to a desktop workflow**, with a Signal→
Telegram push, a public PWA + Mini App behind a shared token, one shared DuckDB, and the Agent SDK
assumed to run one monolithic session. This design supersedes it on the substantive points:

- **A hosted coach, not a companion** — the web app *is* the coach (a Tailscale backoffice); the
  Mini App is dropped; Telegram is present-tense only.
- **n8n drives a `coach` CLI**; the CLI is the single interface; the agent is Claude Code via the
  SDK, wrapped by the CLI (not n8n's LLM nodes).
- **Plugins + head coach/specialists** replace the flat command set; **four data kinds** replace
  one `protocols/` directory; **one DuckDB per profile** replaces one shared store.
- **The daily file splits** into a module-partitioned structured plan + a prose journal;
  durable changes go through a gated `decide` workflow.
- **Runtime/billing** is settled (subscription via the SDK, no forced API pricing) where the old
  spec left it open.
- The **brief layer** and the Garmin split survive from the old spec, refined.
