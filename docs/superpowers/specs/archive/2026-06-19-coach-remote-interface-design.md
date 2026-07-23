> **⚠ SUPERSEDED (2026-07-23) by `2026-07-23-remote-coach-v1-design.md`.** A wayfinding effort
> (map at `.scratch/coach-remote/`, 50 decisions) substantially reworked this design: n8n drives
> a `coach` CLI; plugins + head-coach/specialist agents; four data kinds; one DuckDB per profile;
> a Tailscale web-app backoffice with the Mini App dropped; runtime settled on the Agent SDK.
> This document is kept for history only — read the 2026-07-23 spec for the current design.

# Remote Coach Interface — Design

**Date:** 2026-06-19
**Revised:** 2026-07-22 — added the brief layer, replaced Signal with Telegram, replaced
`/report` with `/week`
**Status:** SUPERSEDED — see `2026-07-23-remote-coach-v1-design.md`
**Author:** Coach service brainstorm (Pedro + Claude)

## Problem

The coaching system works, but it is chained to the desktop. Every time-sensitive
interaction — reading the day's plan, logging meals and sessions, and actually
conversing with the coach to adjust the day — requires sitting at the computer with
Claude Code open. The athlete is frequently away from the machine when these needs
arise (at the gym, in the kitchen, out running, during the day).

The athlete never edits the protocol or logbook files directly; those are the coach's
working medium. So the requirement is **not** file access. It is a remote
**conversation and reading** surface for the coach.

## Goals (v1)

- Read today's plan from a phone, rendered as proper formatted markdown.
- Read the current monthly report and scroll recent daily files.
- Log meals, sessions, and notes by chatting, from anywhere.
- Converse with the coach — ask questions, request adjustments — from anywhere.
- Receive a morning push with the drafted plan summary and a link to read it.
- Push approved workouts to the Garmin watch, on approval, exactly as `/garmin` does today.
- Make the coach's own structured metrics (nutrition actuals, day-type, ACWR, RPE, etc.)
  queryable for longitudinal reasoning — without leaving the file-based workflow.
- Consult **and** edit the protocols (and any document) from the PWA/chat, with every
  change committed and pushed to git so the rulebook is always recoverable.
- Deploy as an isolated, Dockerised app via Dokploy from a git remote, so moving servers
  is just a redeploy.
- **Hand each command its data pre-staged.** A deterministic builder syncs Garmin and
  assembles a per-command brief — raw markers plus the repeatable derived numbers — so the
  agent spends its reasoning on the judgement call, not on re-fetching and re-deriving the
  same arithmetic every morning. See "Brief layer".
- **Close the week and preview the next one.** A Sunday-night `/week` command reports on the
  week just finished, asks over chat for the handful of inputs the data cannot supply, and
  drafts next week's schedule — so constraints and blockers surface before the week starts
  and the athlete knows what is coming. See "`/week`".
- **Make chat interactive rather than free-text-only.** Bounded answers are buttons and
  forms, not prose the agent has to parse. See "Interaction surface".

## Non-goals (v1)

- No charts, trend graphs, or analytics dashboard (deferred to v2).
- No history search or full-text search across logbook.
- No multi-user support; this is single-user.
- No manual file-editing surface — documents are edited by *chatting* the coach, not by a
  rich text editor in the PWA. Files remain the coach's medium.
- No web-push for the PWA. Telegram is the push channel; the standalone PWA is pull-only.
- No per-exercise strength-set table and no reports-as-queries yet — deferred to v2
  (see Data model).
- No pushing weigh-ins/body composition to Garmin — an external Withings→Garmin job
  already handles that; the coach only reads weight. Workouts are the sole Garmin write.
- **No week-ahead push to Garmin.** `/week` drafts next week's schedule as a document only.
  Workouts still reach the watch one day at a time through `/garmin`, after the athlete
  approves that day's plan. `schedule_week` stays unused.
- **No rule evaluation in the brief builder.** The builder computes numbers; it never
  decides. Coaching thresholds and decision trees stay in `protocols/*.md` where they can be
  edited without a deploy.

## Constraints and decisions

- **Stack:** **Node / TypeScript** for the relay (and serving the PWA), using the
  first-party `@anthropic-ai/claude-agent-sdk`. The PWA frontend is plain static HTML/JS.
- **Host:** the athlete's own server, always-on. Becomes the home of the coach.
- **Front surface:** a **Telegram bot** is the primary surface — push, conversation, and
  bounded answers as buttons. The self-hosted **PWA** is served both as a Telegram **Mini
  App** (rendered inside the chat) and as a standalone installable PWA at the same URL. One
  bundle, two entry points. See "Interaction surface".
- **Auth / network:** handled by Dokploy's reverse proxy (Traefik) — HTTPS + domain. Inside
  Telegram the Mini App authenticates with `initData`, HMAC-validated against the bot token;
  the standalone PWA route keeps a single shared token in front of the relay.
- **Deployment:** the app lives in an isolated **`/app`** folder, is **Dockerised**, and
  deploys via **Dokploy** from a **private GitHub remote**. A single app container is
  enough — Telegram needs no sidecar, only outbound HTTPS to `api.telegram.org` and an
  inbound webhook route. Data persists on a Docker volume that is a clone of the repo; the
  app pushes changes back to the remote. See "Deployment & repo layout".
- **Command data:** every command reads a **pre-built brief** rather than fetching and
  deriving its own inputs. The brief builder is deterministic code, not the agent. See
  "Brief layer".
- **Git model:** git is the durable store. **Every document change** — `protocols/*`, the
  daily logbook (with its frontmatter), reports — is **committed and pushed** to the
  private GitHub remote as it happens, so the rulebook is always recoverable. The
  DuckDB/Parquet **store is committed too, but once daily** (after the morning sync) — it is
  binary and derived, so per-sync commits would bloat history; daily is enough for
  warm-start recovery. Move to git LFS if it outgrows ~50–100 MB. See "Data model".
- **Garmin layer (split):** **reads** go through **`garmin-cli`** (Rust) syncing into a
  local **DuckDB/Parquet** store that the agent queries with SQL; **writes** (structured
  workout creation + scheduling) go through the existing **MCP** (`Taxuspt/garmin_mcp`),
  which also remains the fallback for any read the local store does not cover. See
  "Garmin access" below.

## The brain: reuse the existing repo

Do not rebuild the coaching logic. The existing `.claude/commands` (`/plan`, `/log`,
`/week`, `/body`, `/garmin`, `/skin`), the `coach` skill, `AGENTS.md`, and the `protocols/`
files already encode the entire coaching brain. The new system runs **Claude Code
headless** inside this repo on the server and relays chat to/from it.

What changes in those command files is not the coaching — it is where the inputs come
from. Steps that read "pull Garmin data" or "compute the trailing ledger" become "read the
brief; do not recompute these fields." The judgement steps are untouched.

Mechanism — the first-party **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`):

- `query({ prompt, options })`, async-iterated for streaming.
- `options.systemPrompt = { type: 'preset', preset: 'claude_code' }` and
  `options.settingSources = ['project']` so the session loads `CLAUDE.md` / `AGENTS.md`
  and the project's command/skill definitions.
- `options.mcpServers` supplies the Garmin MCP (the same `uvx` command currently in
  `.mcp.json`), with `allowedTools` scoped to the **write** tools the commands use
  (`mcp__garmin__create_strength_workout`, `schedule_workout`, `upload_workout`, etc.).
- **Reads** are served by the brief for every field a command routinely needs. Ad-hoc SQL
  over the local store, run via the `Bash` tool (`garmin query …` or `duckdb` against the
  Parquet files), remains available for questions the brief did not anticipate. The read
  half of `/plan`, `/log`, `/body`, and `/week` is rewritten from MCP read tools to the
  brief plus this query path.
- `options.resume = sessionId` to continue the same conversation within a day.
- The relay runs in the repo working directory so file reads/writes land in the logbook.

> Confirmed: the SDK executes project **slash commands** under the `claude_code` preset
> with `settingSources: ['project']`, so the relay issues `/plan`, `/log`, etc. as prompts.
> Optional refinement: inline a command file's prompt text instead of the `/slash`
> shorthand for tighter parameterization (e.g. injecting the date or the user's message) —
> an implementation choice, not a blocker. Skills under `.claude/skills` (the `coach`
> skill) load via the same project settings.

## Architecture

One host (the server), as a single Docker container managed by Dokploy:

1. **garmin-cli + local store** — `garmin sync` pulls Garmin health metrics and activity
   summaries into a local **DuckDB/Parquet** store on a schedule. The agent reads from
   this store. Browser-SSO auth (`garmin auth login`); token persisted on the server.
2. **Garmin MCP** — `uvx` stdio server, used for **writes** (workout create/schedule/
   upload) and as a read fallback. Credentials in server env, not git.
3. **Relay backend** (Node / TypeScript) — owns Claude Agent SDK sessions, exposes an HTTP
   API to the PWA and a webhook to Telegram, and runs the scheduled jobs. Maintains a
   per-conversation session id for same-day continuity.
4. **Brief builder** — deterministic, non-LLM. Runs immediately before each *command*
   invocation (plain conversation skips it): forces a `garmin sync`, queries the store,
   reads the logbook and protocols, and writes a single per-command brief the agent consumes
   as its first act. See "Brief layer".
5. **PWA / Mini App** (static, served by the relay) — chat view + rendered reading views
   (today, report, week, recent days) + the structured forms `/week` uses. Reachable inside
   Telegram as a Mini App and standalone as an installable PWA.
6. **Scheduler** — the periodic `garmin sync`, the morning job, and the Sunday `/week` job,
   via OS cron or an in-process scheduler (e.g. node-cron), at configurable times.
7. **Telegram adapter** — outbound calls to `api.telegram.org` (`sendMessage` with inline
   keyboards, `editMessageText`, `answerCallbackQuery`) and an inbound webhook route.
   Allowlisted to a single `chat_id`. No sidecar container.
8. **Metrics extractor** — parses the structured frontmatter of daily files into the
   DuckDB store; runs on file write and is rebuildable over the whole logbook.
9. **Git syncer** — commits + pushes document changes per-change, and the store snapshot
   once daily, to the private GitHub remote.

```
 phone ──Telegram──▶ webhook ─┐
   │                          │
   └──HTTP (PWA/Mini App)──▶ relay (Node/TS) ──Agent SDK──▶ Claude Code (in repo)
                              │      │                          │
                              │      └─▶ brief builder ──▶ brief.json ──▶ (read first)
                              │                │                 │
                              │                │                 ├─▶ Garmin MCP  [writes]
                              │                │                 └─▶ logbook/ + protocols/
                              │                │                        │ frontmatter
                              │                ▼                        ▼ extractor
                              │      ┌──────────────────────────────┐
                              │      │ local DuckDB/Parquet         │◀── garmin sync (cron)
                              │      │ (derived; daily git snapshot)│      ◀── Garmin Connect
                              │      └──────────────────────────────┘
                              │
                              ├── docs + store ──▶ git syncer ──push──▶ private GitHub remote
                              │
                              └──▶ Telegram ──▶ phone   (morning push, Sunday /week questions)
```

## Data flows

### Chat (read / log / converse)

1. A message arrives from the Telegram webhook or from the PWA (`POST /chat`), carrying the
   conversation's session id.
2. If the message invokes a command, the relay runs the **brief builder** for that command
   first and passes the brief path in the prompt. Plain conversation skips the builder.
3. Relay runs `query({ prompt: message, options: { resume: sessionId, ... } })`.
4. Relay streams assistant text back — to the PWA over SSE, to Telegram as messages, with
   bounded questions rendered as inline keyboards rather than prose.
5. If the message implies a logbook write (a logged meal/session, an approved plan
   change), Claude writes the file directly via its file tools — same as a desk session.
6. A daily-file write triggers the **extractor**, which refreshes that day's structured
   rows in DuckDB from the file's frontmatter — the file stays canonical.
7. When the coach needs quantitative data the brief did not carry, it queries the local
   DuckDB with SQL; it falls back to the MCP only for Garmin fields the store does not hold
   (e.g. per-sample data for indoor runs).

### Reading views — three document sections

The PWA presents the documents as three nav sections, each a plain file read (no Claude
round-trip):

- **Protocols** — `GET /protocols` lists `protocols/*`; `GET /protocols/:name` renders one.
- **Plans** — `GET /today` renders today's `logbook/<YYYY-MM>/<YYYY-MM-DD>.md`;
  `GET /days` lists recent daily files for the scrollable history;
  `GET /week` renders the current week file for the week-ahead preview.
- **Reports** — `GET /report` renders the current `logbook/<YYYY-MM>/report.md`.

**Editing** any document (most often a protocol) happens through chat — "raise the easy
ceiling in `running.md` to 144" — and the coach edits the file via its file tools. Each
such edit is committed and pushed immediately (see Git model). The PWA has no separate
editor.

### Morning push

1. Cron triggers the relay's morning job at the configured time. The job runs the **brief
   builder** for `/plan`, which **first forces a `garmin sync`** so the store holds this
   morning's readiness/sleep/HRV before any reasoning (sync-then-query — the DB does not
   eliminate the morning fetch, only the repeated per-call fetches and all historical
   aggregates), then assembles the plan brief.
2. Relay issues `/plan` to a fresh session, passing the brief. Claude reads the brief,
   reconciles it against the current week file, drafts the day, and (per the existing
   interactive contract) **proposes** without committing to Garmin.
3. Relay writes the drafted daily file and sends a **Telegram** message: a short summary, any
   `ASSUMED` inputs still outstanding from Sunday, and `[Approve → push to watch] [Adjust]`
   as inline keyboard buttons.
4. The athlete approves with a tap, or opens the Mini App to read the full plan and adjust
   by chatting.
5. On the approve callback, the coach runs `/garmin` to push the structured workouts to the
   watch. **Nothing reaches Garmin before approval.** Because approval arrives as a callback
   carrying the plan date and a nonce, there is no ambiguity between "yes" as approval and
   "yes" as conversation.

### Sunday `/week` job

1. Cron triggers the `/week` job Sunday evening. The builder produces the **week brief** —
   the closing numbers for the week just finished.
2. Claude writes the close: the week block appended to the monthly report, the refreshed
   `current-status.md`, and the updated strength loads. This needs no input and runs
   unattended.
3. Claude asks its questions over Telegram — buttons for bounded answers, a Mini App form
   for the week-ahead calendar.
4. Claude drafts next week's file, tagging every input `CONFIRMED` or `ASSUMED`.
5. Monday's `/plan` reads that file, re-tests its schedule against the morning's markers,
   and opens by asking about anything still `ASSUMED`.

Detail in "`/week`" below.

## Brief layer

Every command reads a pre-built brief instead of fetching and deriving its own inputs. The
builder is ordinary TypeScript over DuckDB — no model in the loop — and runs immediately
before the command's agent turn. Plain conversation does not trigger it.

### Pipeline

`forced garmin sync` → `builder queries store + reads logbook/protocols` → `brief written`
→ `agent reads brief as its first act`.

Briefs are generated per invocation and never reused, so there is no stale-brief failure
mode. They are written to a gitignored working directory: the brief is derived, and the
derived numbers that matter for audit already land in the daily file's frontmatter, which
the extractor projects into DuckDB. No new commit surface.

### Coverage

One brief per command that consumes data: `plan`, `log`, `week`, `body`. `/garmin` needs
none — it consumes the already-approved plan — and neither does `/skin`, which is a bare
capture.

### Shape

```
schema_version   pinned by each command doc; a mismatch is a hard failure
generated_at     the agent refuses to reason on a brief older than the freshness window
for_date
sources          { garmin_sync_at, last_daily_file, status_last_verified }
data             raw markers — readiness, hrv, bb_wake, sleep, rhr, weigh_ins[], activities[]
derived          ledger[7], consecutive_run_days, days_since_rest, hard_sessions_7d,
                 acwr, composite_load, weight_7d_avg, phase, phase_week, day_type,
                 calorie_tier{kcal,P,C,F}, strength_slice
gaps             [ { field, reason, action } ] — what the builder could not fill
```

`strength_slice` resolves the whole lookup chain the agent currently walks by hand:
the day's gym → the movements that gym can actually perform → current working load × reps →
rotation group versus the last same-type session. G1's constraints (no dip station, no
pull-up bar, crossover yes but cable row no) are equipment facts the agent should be handed,
not asked to remember.

`gaps` makes missing data explicit rather than silent. The Garmin Daily Suggested Workout is
the standing case: when the endpoint returns nothing, the builder emits a gap instructing the
agent to ask the athlete, so a required cross-check stops depending on the agent recalling a
step buried in the command file.

### Division of labour

The builder owns **arithmetic and lookups**: how ACWR is computed, what counts as a "hard"
session, how days-since-rest is counted, which tier a day type maps to, which exercises a
gym allows. `protocols/*.md` own **thresholds and decisions**: flag ACWR above 1.3, the
sleep and readiness decision tree, the Cumulative-Load Rules, the meal-distribution rules.
The agent reads that prose and makes the call.

The line is deliberate. Numbers in code are testable and consistent; policy in markdown can
be changed by editing a file rather than shipping a deploy. The brief therefore reports
facts and never verdicts — it says `acwr: 1.12`, not `acwr ok`.

### Why this is worth building

- **Correctness becomes testable.** ACWR, the trailing ledger, and the streak counts become
  unit-tested functions with fixture data. Today they are re-derived in prose every morning
  with nothing verifying them, and that is precisely the class of error behind the
  2026-06-24 miss.
- **One number, one source.** Command docs change from "pull X, compute Y" to "read the
  brief; do not recompute these fields", so the same quantity cannot come out two ways in
  one session.
- **Cheaper and faster.** `/plan` currently costs roughly ten MCP round-trips plus several
  file reads before it reasons at all. That collapses to one read.
- **The mundane work stops being re-litigated.** What the agent contributes is the reaction
  to the numbers and the personal constraints around them, which is exactly where its
  judgement is worth spending.

### Failure handling

- Sync failure — the builder marks `sources.garmin_sync_at` stale and emits a gap; the
  command reports degraded data rather than silently reasoning on yesterday.
- Schema mismatch — hard failure with the expected and actual versions named.
- Missing protocol lookup (an unknown day type, an unmapped exercise) — a gap, never a
  guessed default.

## Interaction surface

Telegram is the push and conversation channel. The `signal-cli-rest-api` sidecar and its JVM
are dropped, along with number registration, linked-device handling, and Signal rate limits.

### Mechanism

The relay calls `api.telegram.org` outbound and receives updates on a webhook route,
protected by the `X-Telegram-Bot-Api-Secret-Token` header and hard-allowlisted to a single
`chat_id`. Traefik already terminates HTTPS on a domain, so the webhook needs no new
infrastructure.

Three affordances, used for different jobs:

- **Inline keyboard buttons** (`callback_data`) for bounded answers — skin severity 0–5,
  approve or adjust, day-type confirmation. The reply is a tap, and `editMessageText`
  collapses the question into its answer in place so the thread stays readable.
- **Mini App** — the PWA rendered inside the chat, launched from a `MenuButtonWebApp` for
  the persistent entry point and from `web_app` inline buttons for specific forms such as
  the `/week` calendar. Authentication uses `initData`, HMAC-validated against the bot
  token, so there is no second login. The same bundle stays reachable as a standalone
  installable PWA, which keeps shared-token auth on that route.
- **Free text**, routed straight into the agent session. This is what makes logging from the
  gym work, and it is the largest usability gain in the design.

### Why not Signal

Signal has no bot platform. `signal-cli` is a reverse-engineered client and the protocol
carries text and attachments only — no buttons, no forms, no callbacks. Interactive prompts
cannot be built on it at any effort level.

WhatsApp's Business API does support buttons and list messages, but it requires Meta
approval, pre-approved templates for any message sent outside a 24-hour session window
(which the Sunday evening push always is), and per-message pricing. Too much machinery for a
single-user service.

### Sensitivity policy

Telegram bot chats are not end-to-end encrypted; message content rests readable on
Telegram's servers. This is the real cost of the choice and it is accepted deliberately, with
a boundary:

**Chat messages carry prompts, prompts' answers, and short summaries. Anything detailed —
weight and body composition, skin history, medication — renders in the Mini App**, which is
served from the athlete's own domain over HTTPS and never transits Telegram's servers. This
is a rule the implementation must enforce, not a matter of judgement per message.

## `/week`

`/week` replaces `/report`. It runs Sunday evening on cron and can be invoked by hand. It
does two jobs: it reports on the week that finished, and it drafts the week that starts —
so constraints and blockers surface before the week begins and the athlete gets a preview of
what to expect.

### Phase 1 — close (unattended, needs no input)

The week brief supplies prescribed-versus-actual across all seven days, weekly kilometres,
ACWR, composite load against the rolling four-week average, the seven-day weight average
versus the prior week, average daily steps, sleep, HRV, stress and resting-HR trends, the
strength session count with loads logged per movement, and the cut-phase running scoreboard.
It also drains the week's pending `/skin` captures. Claude then writes:

- the week's block appended to `logbook/YYYY-MM/report.md`;
- `protocols/current-status.md` — the Key Metrics rows plus `Last verified` set to today;
- `protocols/strength-exercises.md` — working loads, last-logged dates, and any Garmin enum
  status that `/garmin` confirmed during the week.

Setting `Last verified` weekly resolves a standing inconsistency: `/plan` treats
`current-status.md` as stale after seven days, but `/report` was documented as monthly, so
the staleness guard fired by design most of the time. A Sunday cadence matches the guard.

The skin block is written as `not assessed` until Phase 2 answers it.

### Phase 2 — questions over Telegram

Two standing questions, one conditional:

1. **Skin** — severity as a 0–5 button row, then areas, regimen, and change since last week
   through a short Mini App form.
2. **Next week's fixed commitments** — a Mini App weekly form covering the PT day and its
   gym, travel, social meals, events, and any night already known to be short.
3. **One conditional question** about something the data flagged and cannot explain: a
   skipped session, an ACWR breach, an unexplained weight move. Asked only when triggered.

The question budget is deliberate. Three questions a week is a ritual that survives; seven
is one that gets ignored within a month, and an ignored Sunday job takes the week-ahead
draft down with it.

### Phase 3 — prep

Claude writes `logbook/YYYY-MM/week-YYYY-MM-DD.md`, keyed by its Monday. A week crossing a
month boundary lives in the month it starts in.

- `## Inputs` — every input tagged `CONFIRMED` or `ASSUMED`, plus the markers the schedule
  was built on.
- `## Envelope` — phase week, volume target, quality count, long run, strength count,
  deload flag, and any phase transition landing within seven days.
- `## Schedule` — the seven named days.
- `## Owed` — corrective actions the close generated, such as the logged action an ACWR
  breach or a sub-30 km volume floor requires.

**Nothing reaches Garmin.** Daily approve-then-push through `/garmin` is unchanged.

### Guarding the re-derive rule

A written week schedule is in direct tension with `/plan`'s rule to *re-derive this week's
shape from scratch — do not inherit the prior day's "Week ahead" table*, which exists
because a stale "recovery week" label was once carried forward unexamined. The schedule is
worth having anyway, for the preview and the constraint-surfacing, so the tension is managed
rather than avoided:

- The named session is a **hypothesis to re-test**, never a default to confirm.
- `/plan` must state whether today's markers still support it, to the same logged-reason
  standard the Cumulative-Load Rules apply to an override.
- The `## Inputs` stamp is what makes this checkable. Because the file records the markers it
  assumed, `/plan` can compare them against this morning's and say plainly when they have
  moved.
- Where an input is still `ASSUMED`, `/plan` opens by asking.

### If the questions go unanswered

The close is already written, so nothing is lost. The next-week draft is still produced, with
every unanswered input written as an explicit `ASSUMED` line — never silently defaulted and
never quietly copied from last week's shape, which is the failure the re-derive rule exists
to prevent. Monday's `/plan` surfaces the assumptions first thing and re-asks.

### Month boundary

The monthly synthesis is written by the first `/week` run *after* a month closes, placed at
the top of that month's `report.md`. It needs the complete month, so tying it to the last
Sunday would truncate it.

### Migration

`/report` is removed from `.claude/commands/`, from the protocol-lookup table in
`AGENTS.md`, and from the workflow list, which gains the Sunday step. References to `/report`
in `plan.md` (the staleness recommendation) point at `/week` instead.

## Garmin access

**Reads → `garmin-cli` + local DuckDB/Parquet store. Writes → MCP.**

### Why split

Coaching is a longitudinal problem. The metrics that drive decisions — ACWR, trailing
7/28-day load, HRV-vs-volume trend, sleep-vs-performance correlation — are historical
*aggregate* queries. Fetching them as discrete MCP calls every session is slow,
token-heavy, and pushes the aggregation into the model's head. A local analytical store:

- expresses those queries directly in SQL (ACWR is one statement, not N fetches + mental
  arithmetic);
- collapses many JSON tool-call payloads into one compact result set (fewer tokens, lower
  cost — material given subscription Agent-SDK credits);
- stays queryable when the Garmin API is flaky at query time.

Writes stay on the MCP because it is the only layer that **creates and schedules
structured workouts** (strength-exercise enum mappings, `create_strength_workout`,
`schedule_workout`, `upload_workout`). `garmin-cli` has no planned-workout builder — its
writes are weight, activity-note edits, and completed-FIT upload (the wrong direction).

### Writes — what we push to Garmin

The coach pushes **only structured workouts**, via the MCP (`/garmin`):
`create_strength_workout`, `create_walk_run_workout`, `upload_workout`, then
`schedule_workout` / `schedule_week`. This is the entire Garmin write surface.

**Body/weight is not pushed by the coach.** An existing external job syncs the Withings
scale into Garmin automatically, so weigh-ins arrive on their own and flow into the local
store via `garmin sync` (the `WeightEntry` table). `/body` therefore only **reads** that
weight and updates target deltas in the logbook — no Garmin write.

Not pushed either: nutrition/food — logged nowhere digitally, deliberately kept out of
Garmin.

### Freshness — sync-then-query

The store does **not** eliminate the morning fetch: training readiness, last night's
sleep, HRV, and body battery only exist after the watch syncs this morning. So:

- a periodic `garmin sync` (cron) keeps the store warm during the day;
- the morning job **forces a `garmin sync` first**, then the agent queries local;
- more generally, **any command that needs current data — `/plan`, `/log`, `/body`, `/week`
  — forces a sync before it reads**, so it never reasons on stale data. This is the brief
  builder's first step, so the guarantee is structural rather than a rule the agent has to
  follow.

The win is on history (incremental sync) and on every aggregate query, not on skipping the
day's first pull.

### Schema coverage — confirmed from source (`crates/garmin-cli/src/db/models.rs`)

The store's tables cover what the commands consume:

- **Daily markers** (`DailyHealth`): sleep total/deep/light/REM + score, HRV (weekly avg,
  last night, status), resting HR, stress avg/max, body battery start/end, respiration,
  SpO2 — covers `/plan` readiness and `/body`.
- **Readiness/status** (`PerformanceMetrics`): training readiness, training status,
  lactate-threshold HR, endurance score.
- **Activity summaries** (`Activity`): avg/max HR, distance, duration, speed, elevation,
  cadence, power, training effect, training load, running dynamics.
- **Per-sample** (`track_points`, per **GPS** activity): `timestamp`, `heart_rate`, `lat`,
  `lon`, `elevation`, `cadence` are populated; `speed` and `power` exist in the schema but
  are **never populated**. Indoor/treadmill activities produce **no rows at all**.

There is **no splits/laps table and no time-in-HR-zone field**. Both are **derivable from
`track_points` — but for outdoor GPS runs only** (resolved by the spike, 2026-06-19; see
`2026-06-19-trackpoint-spike-findings.md`):

- **Time-in-HR-zone** — bucket outdoor points by `heart_rate` band, sum time deltas. Works
  outdoors. **Not available indoors** — treadmill runs produce zero track points, so indoor
  HR-zone must come from the activity summary (`avg_hr`/`max_hr`) or the MCP.
- **Per-km splits** — `track_points` has no distance column, and **`speed` is unpopulated**
  (null on every run), so `speed × Δt` does not work. Outdoor splits are integrated from
  **haversine over `lat/lon`** instead; a reusable `v_activity_splits` view is a v1 build
  item, **outdoor-only**. Treadmill splits are **not** derivable from track points — use the
  activity summary (`distance_m` / `duration_sec` / `avg_speed`).

Consequence: the MCP **read** fallback for `/log` is **required after all** — for
per-sample analysis of treadmill/indoor runs, which the local store does not cover. Most
`/log`, `/plan`, and `/body` needs are nonetheless met by the **activity summary** (avg/max
HR, distance, duration, pace, cadence, training effect/load, elevation, running dynamics);
track points add per-km splits and intra-run HR-zone/drift for outdoor runs only.

### Resolved — does `sync` populate `track_points`? (spike, 2026-06-19)

**Yes for outdoor GPS runs; no for indoor/treadmill.** `garmin sync run` ingests per-sample
points by default (no flag) for any activity carrying a GPS track — ~1 Hz, ~54 KB of
Parquet per outdoor run. Treadmill runs produce **zero** track points, and `speed`/`power`
are unpopulated even outdoors (so outdoor splits use haversine over `lat/lon`, not speed).
Storage is ~10 MB/year — well under the LFS threshold. Full evidence and the read-path
decisions are in `2026-06-19-trackpoint-spike-findings.md`.

### Auth

`garmin-cli` uses browser-SSO (`garmin auth login`); persist its token on the server. The
MCP's `garth` likewise caches an OAuth token, so its password only seeds the first login
and is not relied on in plaintext thereafter. Two Garmin integrations means two auth
states to keep alive — an accepted cost of the split.

## Data model — files canonical, DuckDB derived

The coaching data splits by *kind*, not by source.

- **Documents → files + git (canonical).** `protocols/*` (rules/config), monthly reports
  (narrative), and the **prose** of daily logs (readiness notes, how a session felt,
  decisions). Version-controlled, human- and agent-readable. A database here would be
  strictly worse.
- **Structured metrics → DuckDB (derived, queryable).** The coach's own quantitative
  time-series that Garmin does not hold: nutrition actuals (kcal/macros — the athlete
  weighs food and logs nothing digitally), `day_type`, phase, ACWR, prescribed-vs-actual,
  and subjective signals the model already reasons over (RPE, pain, sleep-onset latency,
  protein-bolus distribution, social-day damage-control events), plus body metrics. These
  live in the **same DuckDB** as the Garmin data, keyed by date — one store for everything
  quantitative.

### Single source of truth: frontmatter, extracted

So the daily file and the DB never drift, the file stays canonical and the DB is a
**derived projection**:

- The daily file carries its required fields as a **machine-readable block** — YAML
  frontmatter (or a fenced data block) — while prose stays in the body.
- A small **extractor** loads that block into DuckDB whenever a daily file is written or
  changed. Lossless, no NLP.
- The DuckDB is therefore **rebuildable from git at any time** (`garmin sync` + re-run the
  extractor over the logbook). It is a cache, not a second source of truth.
- It is nonetheless **committed once daily** (a binary snapshot under `/store`) so a fresh
  deploy starts warm and the non-reproducible slice — historical Garmin data that may no
  longer be re-fetchable — is backed up. Daily, not per-sync, because it is binary; LFS if
  it grows. The canonical markdown remains the real backup, committed per-change.

This keeps the file-based workflow intact (git history, readability, agent-native
authoring) while making longitudinal queries fast.

### Scope

- **v1:** frontmatter-ise the existing `daily-template` required fields and build the
  extractor plus the day-level metrics tables. The coach reads them through the same SQL
  path as Garmin data.
- **v2:** per-exercise strength-set logging (sets/reps/load per movement) and generating
  monthly reports as DuckDB queries instead of hand-authored prose. Bigger, and not needed
  to remove the current inefficiency.

## Session and context model

- **Long-term memory lives in the files** (protocols, daily logbook, reports), exactly as
  today — canonical. Quantitative history is *additionally* projected into DuckDB for fast
  queries (derived). The coach reads files each session; nothing important depends on chat
  history surviving.
- **Short-term continuity within a day** uses Agent SDK session `resume` so a chat thread
  feels continuous ("change today" → "ok and also…").
- Sessions can be reset daily (or per the morning job) without loss, since state is the
  files.

## Deployment & repo layout

```
/app/           ← deployable app: relay (Node/TS) + brief builder + PWA/Mini App + Dockerfile
/.claude/       ← commands + skills (the coaching brain)
/protocols/     ← rulebook documents (Protocols section)
/logbook/       ← daily files, week files, monthly reports (Plans + Reports sections)
/store/         ← DuckDB/Parquet store (committed daily)
/store/briefs/  ← generated briefs — gitignored, regenerated per invocation
AGENTS.md /CLAUDE.md /docs/   ← existing
```

- **Isolation:** all application code is under `/app`; the rest of the repo is the brain +
  documents + store. Dokploy builds from `/app`.
- **Container:** a single *app* image — Node + the `claude` CLI + python/`uv` (for the stdio
  Garmin MCP, spawned as a child process, so it must be in-container) + the `garmin-cli`
  binary + the DuckDB Node client. This is a multi-runtime image and an explicitly
  non-trivial part of the build. Telegram adds nothing to it: outbound HTTPS and a webhook
  route, no sidecar.
- **Persistence = repo clone on a volume.** Document/store state lives on a Docker volume
  holding a git working copy. On first boot the app clones the private remote into the
  volume; thereafter it commits + pushes changes. The container image carries the app; the
  volume carries the brain + documents + store.
- **Source of truth is the remote, not the server.** Move servers → Dokploy redeploys,
  the app re-clones from GitHub, and everything (documents + last daily store snapshot) is
  there. This is the "ready to go" guarantee.
- **Prerequisites:** a **private GitHub repo** (none configured today) connected to Dokploy
  via its GitHub app/deploy key; and a push credential (deploy key or fine-scoped PAT) the
  app uses to push, stored as a Dokploy secret.

## Secrets and configuration

- **Mandatory before any remote push:** move the Garmin password out of the committed
  `.mcp.json` into a Dokploy secret / env var. Plaintext in a repo with a remote is a leak.
- Secrets (Dokploy env): Garmin credentials, the git push credential (deploy key / PAT), the
  **Telegram bot token**, the **webhook secret token**, the **allowlisted `chat_id`**, and
  the standalone-PWA token. The `garmin-cli` SSO token and the MCP `garth` token persist on
  the volume, not in the image.
- The bot token is doubly load-bearing: it authenticates outbound API calls *and* is the key
  used to validate Mini App `initData`. Leaking it means both impersonating the bot and
  forging authenticated Mini App sessions.
- Configurable: morning-job time, Sunday `/week` job time, `garmin sync` cadence (default:
  hourly plus a forced sync at the head of every brief build), daily store-commit time,
  brief freshness window, model id, repo path, store path, brief path, GitHub remote URL.

## Risks and open implementation questions

- **TrackPoint ingestion (resolved 2026-06-19)** — `garmin sync` populates `track_points`
  for outdoor GPS runs (default, ~54 KB/run) but **not** for treadmill/indoor runs (zero
  points), and `speed`/`power` are never populated. `/log` **does** need the MCP read
  fallback for indoor per-sample analysis; outdoor splits use haversine over `lat/lon`, not
  `speed`. See `2026-06-19-trackpoint-spike-findings.md`.
- **Sync ordering/freshness** — the morning job must force a sync before reasoning; guard
  against a `/plan` running against a stale store.
- **Two third-party Garmin deps** — `garmin-cli` and the MCP can each break or drift
  (schema, auth). Two things to keep alive.
- **Read-path rewrite** — `/plan`, `/log`, `/body`, `/week` read halves move from MCP
  tool-calls to the brief; an upgrade, but real work and a regression surface to test.
- **Brief/protocol drift** — the builder and `protocols/*.md` must agree on definitions even
  though they own different halves. If `training.md` redefines what counts as a "hard"
  session, the builder's `hard_sessions_7d` silently means something else. Mitigation: the
  builder's definitions are unit-tested against fixtures derived from the protocol text, and
  `schema_version` bumps force the command docs to be revisited.
- **Command docs must forbid recomputation explicitly** — if a command doc keeps its old
  "compute ACWR" step alongside the brief, the agent will produce two numbers for one
  quantity. The rewrite has to remove those steps, not merely add a brief step.
- **Agent ignoring the brief** — nothing mechanically stops the model from re-deriving a
  field anyway. Worth a spot-check during the read-path rewrite: assert that the daily file's
  frontmatter values match the brief that produced them.
- **Frontmatter/extractor schema** — the `daily-template` structured block and the DuckDB
  tables must stay in lockstep; a template change means an extractor update + a (safe,
  because derived) full re-extract. Keep the DB strictly derived so rebuild is always safe.
- **Daily-template migration** — existing logbook files predate the frontmatter; either
  back-fill them or accept that the metrics history starts at cut-over.
- **Slash vs inline command invocation** — confirmed the SDK runs project `/` commands;
  the only open choice is `/plan` directly vs. inlining the command prompt for tighter
  parameterization. Implementation detail, not a blocker.
- **Telegram is a third-party dependency for the push channel** — an outage means no morning
  push and no Sunday questions. The PWA route stays reachable independently, so the system
  degrades to pull-only rather than failing.
- **Chat content is not end-to-end encrypted** — accepted deliberately, bounded by the
  sensitivity policy in "Interaction surface". The policy has to be enforced in the
  implementation; a summary that quietly includes body-fat percentage defeats it.
- **Public webhook endpoint** — mitigated by the secret-token header and a single-`chat_id`
  allowlist, but it is a new inbound surface that did not exist with a send-only sidecar.
- **A written week schedule can be rubber-stamped** — the whole point of the `## Inputs`
  stamp and `/plan`'s re-test obligation. Worth watching in the first weeks of use: if
  `/plan` starts confirming the week file without genuinely re-testing, the guard is not
  working and the schedule should drop back to an envelope.
- **Unanswered Sunday questions compound** — one skipped week is handled by `ASSUMED` tags,
  but several in a row means the skin log and the calendar both go dark. `/week` should
  report how long an input has been unanswered rather than re-asking identically.
- **External Withings→Garmin job** — weight freshness depends on that job (outside this
  system); if it stalls, `/body` reads stale weight. Not ours to fix, but worth surfacing.
- **Store binary churn in git** — even daily, a binary store grows history; watch its size
  and move to git LFS past ~50–100 MB before clones/Dokploy pulls slow down.
- **Push credential + remote prerequisite** — a private GitHub repo must exist and the app
  must hold a scoped push credential (Dokploy secret). No remote ⇒ no recoverability and no
  deploy. This is prerequisite #0.
- **Multi-runtime app image** — Node + `claude` CLI + python/`uv` + `garmin-cli` in one
  image is the build's heaviest part; pin versions and keep the Dockerfile reproducible.
- **Volume bootstrap** — first-boot clone, and reconciling a divergence if both the server
  working copy and the remote change (single-writer assumption keeps this simple; document it).
- **Long-running Claude calls** — the morning `/plan` pulls a lot of Garmin data; ensure
  the relay handles multi-minute streaming and timeouts gracefully.
- **Concurrency** — single user, but guard against overlapping morning job + manual chat
  touching the same daily file, and against a Sunday `/week` run colliding with a late
  `/log` for that Sunday.
- **Approval state (largely resolved)** — approval arrives as a Telegram callback carrying
  the plan date and a nonce, so it is unambiguous where parsing "yes" from prose was a guess.
  The relay still has to expire stale nonces and reject a second approval for the same date.

## v2 / later (explicitly out of scope now)

- Trends/charts dashboard built **on top of** the v1 DuckDB/Parquet store (the store
  itself ships in v1; the visual dashboard is the deferred part).
- Per-exercise strength-set logging in DuckDB (sets/reps/load per movement).
- Monthly reports generated as DuckDB queries instead of hand-authored prose.
- History search.
- PWA web-push as a second push channel.
- Auth token in front of the relay if the server goes internet-facing.
- Pushing the whole week to the watch via `schedule_week`, if the daily approve-then-push
  loop proves to be friction rather than a safeguard.
- A brief for `/garmin` if workout upload ever needs data beyond the approved plan.
