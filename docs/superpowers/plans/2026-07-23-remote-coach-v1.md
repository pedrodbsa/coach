# Remote Coach v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan chunk-by-chunk, with a review checkpoint between chunks. Chunks are ordered; do not start a chunk until its dependencies are green.

**Goal:** Build a hosted coaching system reachable from Telegram and a web browser, driven by a deterministic, tested `coach` CLI engine, so the athlete never sits at a desktop to read the day's plan, log, or steer the coaching rules.

**Architecture:** Two cleanly-separated layers. **The engine** — a bespoke TypeScript `coach` library exposed as a single canonical CLI: agent orchestration (Claude Agent SDK), plan schema, validators, lookups, the brief, Garmin writes. **The driver** — n8n: per-profile workflows, Telegram I/O, cron, the HTTP API for the web app, durable human-in-the-loop waits. Every driver reaches the engine by *exec'ing the CLI*; nothing imports the library but the CLI. The multi-agent coach model (head coach decides *whether/what*; specialists decide *how*), the plan schema, and validators-as-CLI-results are the novel/risky parts and are proven **end-to-end at the terminal before any driver wraps them**.

**Tech stack:** TypeScript/Node, the Claude Agent SDK (`query({...})`, subscription-login auth), DuckDB (per-profile store), `vicentereig/garmin-cli` (Rust binary, reads → DuckDB/Parquet), the Garmin MCP (python/`uv`, writes), YAML for the on-disk plan file, n8n (driver), Telegram Bot API, Tailscale (web-app network).

> **This is a greenfield build in a NEW repo.** The current `X:\pedrodbsa\routine` repo is only a **content source** — its `protocols/*.md` and `logbook/` are *ported* into the new structure, never edited in place. No chunk below modifies the current repo's code.

---

## Global Constraints

Every chunk's requirements implicitly include this section. Values copied verbatim from the spec and the map.

- **Profile isolation is a hard invariant.** Every core operation takes a profile and scopes strictly to `data/<profile>/`, and **must never cross**. Cross-profile bleed is the one code-enforced data boundary. *(spec §4, §10; decisions 12, 34)*
- **The CLI is the only writer of coaching content** — the plan file, actuals, state, history. Specialists emit **JSON** (their output contract); the CLI validates and persists **YAML**. The agent never hand-edits the plan file. *(spec §6, §8; decisions 24, 05)*
- **Path-disjoint write authority.** The server writes only under `data/<profile>/`; the terminal (builder) writes only logic paths. Effective policy = defaults (in shared logic) + overrides (`data/<profile>/`). *(spec §13; decisions 05, 36)*
- **Missing ≠ zero.** A missing value is `null` **plus a first-class gap** `{ field, reason, action }`; a real zero is `0`. Output is **structured JSON on stdout, always**. *(spec §8; decision 42)*
- **Sync-then-query.** Every data command force-syncs Garmin first; a failed sync is a **loud gap** that switches that read to the Garmin MCP fallback — never a silent proceed on stale data. *(spec §8, §12; decision 15, ticket 04 issue #18)*
- **Validators return `{ ok, violations: [{ rule, expected, actual, severity }] }`**, severity **hard** (blocks) or **warn** (annotates). Thresholds are read from policy, not hard-coded. On a hard failure the **workflow runner** — not the specialist — re-runs the step once, then **escalates to a stronger model**, then **surfaces as a `needs-input` gate**. *(spec §8; decisions 43, 21)*
- **Model and effort are declared per workflow step**, tunable without a deploy. *(spec §3; decision 21)*
- **Every run step carries an explicit HR/pace target** (warmup and cooldown included) and **every strength movement a resolved load plus its Garmin `category`/`exercise_name`** — so `garmin.push` needs no agent step. *(spec §6; decisions 02, 01)*
- **A one-line `why` per plan element, hidden by default**, one-sentence cap. *(spec §6; decision 23)*
- **`schema_version` pin.** A schema/policy version mismatch is a hard failure naming both versions. Prototype is at `0.2`. *(spec §8)*
- **Runtime is the Claude Agent SDK; auth is a swappable credential defaulting to subscription login.** **Do not opt into usage credits** unless a hard spend cap is wanted. An API key stays a one-line swap. *(spec §11; decision 35)*
- **Garmin split:** reads → `garmin-cli` → per-profile DuckDB/Parquet; writes → the Garmin MCP. Body/weight is **not** pushed (an external Withings→Garmin job supplies it; `/body` reads only). Outdoor splits use **haversine over lat/lon** (device carries no speed); **no `pace` column** — derive from `avg_speed`; indoor activities have **zero trackpoints** (gated on `hasPolyline`) so indoor per-sample analysis uses the MCP. **Pin the `garmin-cli` version and the container base image together.** *(spec §12; ticket 04)*
- **`decide` is web-app + terminal only, never Telegram.** Policy and profile are **read-only to every action**. *(spec §7, §10; decisions 16, 29)*
- **Web-app auth is Tailscale** (no auth build). The only public surface is the **Telegram webhook** (secret-token + `chat_id` allowlist). *(spec §10; decision 37)*

**Source of truth for detail:** the design spec `docs/superpowers/specs/2026-07-23-remote-coach-v1-design.md` — this plan plus that spec are self-sufficient for the implementer. The `.scratch/coach-remote/` map and issues are the brainstorm working material the spec was synthesised from; chunk citations to decisions/tickets are provenance pointers, not required reading, and where they disagree with the spec, the spec wins.

**Sequencing principle:** engine before drivers; de-risk the novel parts first. The full `plan` workflow and the complete action catalogue run and are verified at the terminal (chunks 3–9) **before** n8n, Telegram, or the web app wrap them (chunks 10–13). Test-first for the deterministic engine parts (schema, validators, brief, lookups, drift-control arithmetic) — they are pure and highly testable, and the spec's drift-control fixtures live there.

**Deviation from the suggested spine, noted:** the suggested spine placed "remaining actions" last (chunk 9 of the brief). They are moved **earlier** (chunk 9 here, before the drivers) because Telegram and the web app must have the full action catalogue to drive. Only `decide` + isolation hardening + the girlfriend-compose remain at the end (chunk 13).

---

## Chunk 0 — Prerequisites (ticket 07)

> **Manual gate — execution prerequisite, not a planning item.** The athlete performs this; it is listed so the builder knows it blocks deployment (chunks 10–13), not the engine work (chunks 1–9). Do **not** plan its internals.

**Goal:** the accounts, secrets, and one-time logins that later deployment depends on exist.

**What it produces** (checklist the athlete owns):
- The Garmin password moved **out of the committed `.mcp.json`** into a secret/env var (prerequisite zero — a leak the moment a remote exists); MCP still authenticates.
- A **private git remote** for the new repo, with a scoped push credential (deploy key or fine-scoped token).
- **Telegram bot** registration: token, webhook secret token, allowlisted `chat_id`.
- **Tailscale** provisioned for the web app.
- The one-time **terminal** `garmin-cli` login (email/password + terminal MFA — *not* browser SSO); record where the mode-0600 token JSON lives on the volume.
- **Version pins** recorded as a pair: `garmin-cli` version + container base image.
- The Dokploy host confirmed and its secret-injection mechanism noted.

**How to verify:** the Garmin MCP authenticates with the password sourced from the secret (not the file); `git push` to the private remote succeeds with the scoped credential; the Telegram bot answers `getMe`; a `garmin-cli sync` runs unattended without a password prompt.

**Depends on:** nothing.

**Explicitly defers:** everything runnable. This chunk writes no code.

**Governs:** spec §13 (Prerequisites), issue `07-remote-and-secrets.md`, issue `04-garmin-cli-viability.md`.

---

## Chunk 1 — Repo skeleton, toolchain, CLI entrypoint & output contract

**Goal:** a new repo with the four-kind layout and a runnable `coach` CLI that parses `coach <domain> <verb>`, scopes strictly to `--profile`, and emits the structured-JSON output envelope with first-class gaps.

**What it produces:**
- The new repository, built to the target layout from the start: a **shared logic** tree (the CLI, plugin implementations, workflow definitions, plugin **default** policy) and a server-authoritative **`data/<profile>/`** tree (`data/pedro/` with subfolders for policy-overrides, profile, state, history, logbook, store). *(spec §13; decision 05, 36)*
- A TypeScript project: package manifest, build, a test runner, the DuckDB client dependency, lint. The `coach` binary is wired as the package's bin.
- The **output envelope** type — `{ ok: boolean, data: <T> | null, gaps: Array<{ field, reason, action }>, schema_version }` — and a serializer that always prints it as JSON on stdout.
- The **profile-scoping helper**: resolves a path *only* inside `data/<profile>/` and throws on any path that escapes it. This is the hard-invariant enforcement point.
- A trivial core command (`coach core version`) proving the envelope end-to-end.

**How to verify:** `coach core version --profile=pedro` prints a valid envelope JSON. A unit test asserts the profile-scoper **throws** on a cross-profile path (`data/pedro/../partner/x`) and returns a normalized path for a legal one. `npm test` is green.

**Depends on:** Chunk 0 (only for the remote to eventually push to — the skeleton itself needs no secrets).

**Explicitly defers:** plugin registration, any domain command, DuckDB reads, agent commands, Garmin, YAML plan persistence.

**Governs:** spec §2, §8, §13; decisions 42 (CLI is the one interface), 12/34 (isolation), 36 (repo topology); issue `08-coach-cli-surface.md` (output contract, gaps).

---

## Chunk 2 — Plugin contract sub-spec + registration mechanism

**Goal:** write the load-bearing plugin contract (the spec flags it as deserving its own specification) and implement plugin registration such that an absent plugin is an absent namespace.

**What it produces:**
- `docs/superpowers/specs/2026-07-23-plugin-contract.md` — a short written sub-spec: a plugin **owns its data (own namespace, reads only its own), policy, and state**; **may have a coach** (warrants one if it has a *how* to decide daily **or** domain policy to evolve); **exposes a `coach <domain> …` CLI namespace including a deterministic `summary`**; **declares its `depends_on`**; and **can petition** other domains through the head coach (a capability/priority, never internals). The bar: a future plugin (cycling, household, social life) slots in without touching the core; non-quantitative domains must not be precluded.
- The **plugin registry** in the CLI: each plugin declares namespace, commands, its `summary` provider, and `depends_on`. Command dispatch routes `coach <domain> <verb>` to the registered plugin; an unregistered namespace errors clearly.
- A throwaway **stub plugin** that conforms to the contract, used only to prove registration.

**How to verify:** with the stub registered, `coach stub summary --profile=pedro` routes to it and returns an envelope; after removing it from the active set, `coach stub summary` errors "unknown namespace". A test asserts the registry lists only active plugins and exposes each plugin's declared `depends_on`.

**Depends on:** Chunk 1.

**Explicitly defers:** real plugins, validator content, coaches, summary content (each plugin defines its own later).

**Governs:** spec §4, §15 (contract deserves its own spec); decisions 19, 32, 33 (petitions), 50 (`depends_on`); issue `14-modules-and-profile.md`, issue `08-coach-cli-surface.md`.

---

## Chunk 3 — Plan schema, YAML persistence & the first deterministic command (with drift-control fixtures)

**Goal:** the module-partitioned plan schema as typed structures; the CLI as sole writer (validate JSON → persist YAML); and one real deterministic command — the trailing-load / ACWR computation whose absence caused the 2026-06-24 miss — tested against a fixture DuckDB with fixtures derived from the protocol text.

**What it produces:**
- **Plan schema types** matching the prototype `.scratch/coach-remote/prototypes/2026-07-22.plan.yaml`: root `schema_version`, `date`, `profile`, `title`; `decision` (head coach — day type, readiness, `rules_fired`, `prescribes[]` with per-module `intent` and `depends_on`); `markers` (brief, facts only); `running`/`strength`/`nutrition` blocks, each owning its `session`/`meals`, its `validate`, and its `actual`. The schema carries: **reps in three shapes** (per-set list `[10,10,10,8]`, range `{min,max}`, per-side `{value,per}`); a per-item **`note`** for content that resists structure ("if set 1 flies, go 115 kg"); the one-line **`why`** per element; and per-movement **`garmin` enums** (`category`, `exercise_name`, `status`).
- **`writePlan` / `readPlan`**: the CLI validates a specialist's JSON against the schema and persists **YAML** (chosen for the athlete and git diffs); round-trip stable. This is the sole-writer path.
- A seeded **fixture per-profile DuckDB** used by engine tests (metrics keyed by date).
- The first deterministic command — e.g. `coach running trailing-load` / ACWR — reading policy thresholds and the fixture store, returning the envelope. **Drift-control fixtures** derived from the protocol text pin what "hard session" and "ACWR" mean; a `schema_version` mismatch is a hard failure.

**How to verify (test-first):** a golden-file test round-trips the prototype plan YAML through `readPlan → writePlan` byte-stably; `coach running trailing-load --profile=pedro --date=<fixture-date>` returns the expected ACWR/streak counts from the fixture store; a drift-control test asserts the arithmetic matches the fixtures derived from the protocol text; a mismatched `schema_version` test yields a hard failure naming both versions.

**Depends on:** Chunk 2.

**Explicitly defers:** the brief, live Garmin sync, agent steps, the validator failure-ladder, all other lookups and the specialists' own commands.

**Governs:** spec §6 (the structured plan), §8 (drift control); decisions 24 (CLI sole writer), 25 (partitioned by module), 23 (`why`), 48 (loads in the store); issue `02-plan-schema.md`.

---

## Chunk 4 — Brief builder, Garmin reads & the loud sync fallback

**Goal:** `coach brief build` assembling the two-phase brief (markers + history + per-domain summaries) from the per-profile store, force-syncing Garmin first and degrading **loudly** to the MCP fallback on sync failure; plus the extractor that makes the store rebuildable from git.

**What it produces:**
- The **`garmin-cli` → DuckDB ingestion** path and `coach sync` (force a Garmin sync as the first act of any data command). Outdoor splits computed by **haversine over lat/lon**; pace derived from `avg_speed` (no `pace` column); indoor per-sample reads routed to the MCP (zero trackpoints).
- The **two-phase brief**: markers (sleep, HRV, RHR, body battery, stress — facts, never verdicts) and history pre-built; anything downstream of a not-yet-made decision (day type, tier, slice) is a **callable lookup**, not a pre-filled field.
- The **sync-fail-loud** behavior: a failed sync emits a loud gap and switches that read to the **Garmin MCP fallback**, never a silent proceed. The Garmin DSW empty-endpoint case emits a gap instructing the agent to ask, never a silent skip.
- The **extractor** projecting a daily plan file's machine-readable fields into DuckDB, so the store is rebuildable from git at any time.

**How to verify:** with a stubbed failing `garmin-cli`, `coach brief build --profile=pedro --date=<today>` emits a loud gap and routes to the MCP fallback (MCP mocked) rather than returning stale data; with a seeded store, `coach brief build` returns markers + the concatenation of active plugins' summaries as JSON; an extractor test rebuilds the fixture DuckDB from a fixture plan file and matches the seeded values.

**Depends on:** Chunk 3.

**Explicitly defers:** the actual coaches (summaries here can start minimal per-plugin and fill in as plugins land), agent decisions, Garmin **writes**.

**Governs:** spec §5 (data model), §8 (sync-then-query, gaps), §12 (Garmin access); decisions 34 (one DB per profile, deterministic summaries), 15 (replaceable optimisation layer), ticket 04 findings; issues `08-coach-cli-surface.md`, `04-garmin-cli-viability.md`.

---

## Chunk 5 — Nutrition plugin end-to-end + the nutrition coach (Agent SDK) + the validator ladder

**Goal:** one full vertical plugin — the richest validators — proving the whole engine pattern: default policy + overrides, `summary`, severity-typed `validate`, the two-phase lookups, and the nutrition **coach** as `coach run nutrition` wrapping the Agent SDK. Given a head-coach decision, it emits a validated meal block.

**What it produces:**
- **Nutrition default policy** ported from the current `nutrition.md` + `meal-rotation.md` into shared logic, with the athlete's **overrides** under `data/pedro/`. Effective policy = defaults + overrides.
- `coach nutrition summary` (the compact digest the head coach reads instead of raw domain data).
- `coach nutrition validate` returning `{ ok, violations: [{ rule, expected, actual, severity }] }`, thresholds **read from policy**: protein floor, fat floor, **three protein boluses ≥ 30 g**, **pre-bed protein ≥ 40 g**, kcal tolerance, **iso with the fattiest meal**. Encodes the athlete's prose constraints as *checks*, not a solver (fruit after lunch, eggs in counts not grams, snack funded by a smaller breakfast).
- The **two-phase lookups**: `coach nutrition tier --day-type=…` and the meal build, called *after* the head coach decides.
- `coach run nutrition --profile=… --date=… [--resume=<sid>]` issuing the SDK `query({ model, systemPrompt, mcpServers, allowedTools })` and returning structured JSON (the specialist's output contract). One-shot isolated for a self-contained transform (ingredient swap); continuous session for iterative work.
- The **runner failure-ladder primitive**: on a hard `validate` failure, re-run once → escalate to a stronger model → surface as a `needs-input` gate.

**How to verify:** given a head-coach decision fixture + a brief, `coach run nutrition` emits a meal block that **passes** `coach nutrition validate`; a deliberately broken block (fat floor missed) yields a **hard** violation and drives the ladder (re-run → escalate → gate), asserted by a runner test; the iso-with-dinner rule is enforced. **Build-time checks performed here (first SDK use):** confirm the SDK runs on subscription login (no forced API pricing); measure real cost with `claude -p --output-format json | jq '.total_cost_usd'` over a representative call; verify the exact SDK session/`resume` API and prompt-cache TTL against current `claude-api`/context7 docs.

**Depends on:** Chunk 4.

**Explicitly defers:** the head coach, the running/strength specialists, n8n, chaining, the `meal.confirm`/`meal.log` actions (chunk 9).

**Governs:** spec §3 (coaching model), §4 (plugins), §8 (validators, summary), §11 (runtime/billing); decisions 20, 21, 22 (not a solver), 43 (validator ladder), 47 (session model), 35 (runtime); issues `08-coach-cli-surface.md`, `14-modules-and-profile.md`, `17-agent-runtime-and-billing.md`, `03-claude-max-headless.md`.

---

## Chunk 6 — Running & strength specialists (mirror the nutrition pattern)

**Goal:** the other two specialist plugins, structurally identical to nutrition — proving the pattern generalizes and producing validated `session` blocks the plan workflow will compose.

**What it produces:**
- **Running** plugin: default policy ported from `running.md`'s policy half (workout types, heat rules, taper, race execution) + overrides for the athlete's HR zones/calibration; `summary`; `coach running validate` (**every step — warmup/cooldown included — carries an HR or pace target**, the same check `garmin.push` relies on); the lookup `coach running targets` (selects off the sub-T → threshold → 10K-pace → VO2 ladder, sets reps/paces/HR bands, cross-checks the DSW); `coach run running` via the SDK.
- **Strength** plugin: default policy ported from the strength half of the dissolved `training.md` + the **movement library** from `strength-exercises.md` (name, pattern, rotation group, rep role, Garmin enum + verification status); **working loads live in the store** (`session.log`-written state), not a document; `summary`; `coach strength validate` (**every movement has a resolved load** + Garmin enum, gym can perform, respects the day's constraints e.g. `no_leg_loading`); the lookup `coach strength slice --gym=…` (filters movements by the day's gym, applies rotation + progression against the store's rep-history, resolves loads); `coach run strength` via the SDK.

**How to verify:** from a decision fixture ("quality today" / "upper pull"), `coach run running` and `coach run strength` each emit a `session` block that passes its own `validate`; a running block with a targetless cooldown step fails hard; a strength block with an unresolved load or a legs movement under `no_leg_loading` fails hard; `coach strength slice --gym=G1` resolves loads from the seeded rep-history and honors the rotation group.

**Depends on:** Chunk 5.

**Explicitly defers:** the head coach, the runner/compose, `garmin.push`, `session.log` (chunk 9).

**Governs:** spec §3, §4, §6 (every-step-target / resolved-load constraints); decisions 20, 48 (loads in store), 02; issues `02-plan-schema.md`, `13-policy-state-split.md`, `14-modules-and-profile.md`.

---

## Chunk 7 — Head coach + workflow runner + the full `plan` workflow (terminal, no n8n)

**Goal:** the milestone — prove the whole multi-agent `plan` workflow end-to-end from the terminal: preflight → DSW gate → head-coach decide → lookups → specialists (topo-sorted from `depends_on`) → summary → approve gate → write `plan.yaml`.

**What it produces:**
- **Head coach policy** = the existing `coaching.md` primer as scoped head-coach policy, **plus the dissolved `training.md`**: the Sleep & Readiness Decision Tree, Override Rules, Cumulative-Load Rules, Weekly Structure & Phase-Aware Templates, Double-Day Guidelines, Rest-Day NEAT, Minimum-Effective-Dose Fallback Week, Disrupted-Day Protocol, Tracking Rules, **Deload Rules**. Head-coach rules **quantify over vocabulary the active specialists register** (what counts as "hard" comes from running/strength), so removing a specialist shrinks the vocabulary, not the rule.
- **Mobility** as a policy-only plugin for v1 (contributes "include prehab" and pain as a readiness term; the head coach reads it). A mobility *coach* is deferred (spec §15 open item) — note it, don't build it.
- **`coach run head-coach`** (the decide step) via the SDK: reads the union of active plugins' policy + the brief + summaries, emits the `decision` block (day type, readiness verdict, `rules_fired`, `prescribes[]` with per-module `intent` + `depends_on`).
- **The workflow runner**: composes the `plan` workflow, **topologically sorting steps from `depends_on`** (nutrition after running + strength), running the specialists, calling the summary agent step, and driving gates in **terminal-direct synchronous mode** (`needs-input` DSW gate; `needs-approval` gate where an edit re-enters the decide step and re-opens the gate). The runner returns the structured "awaiting-decision" result the interactive terminal renders inline.
- The `det` write step: persist the composed `plan.yaml` + refresh the metrics snapshot (state).

**How to verify:** `coach run plan --profile=pedro --date=<today>` on a fixed brief runs preflight → decide → lookups → all specialists → summary → approve (confirmed inline) → writes a `plan.yaml` that matches the schema and **passes every specialist's `validate`**; the DSW-empty case opens the `needs-input` gate and, once answered, proceeds; an edit at the approval gate re-enters decide and re-opens the gate. A golden test on a fixed brief asserts the composed plan's structure (day type, prescribed modules, topo order).

**Depends on:** Chunk 6.

**Explicitly defers:** `garmin.push` (chunk 8), n8n/async durable gates (chunk 10), the `decide` policy-change workflow (chunk 13).

**Governs:** spec §3, §7 (actions & workflows, gates), §12; decisions 01 (`plan` shape), 17 (head coach = `coaching.md`), 20, 30, 45 (gate modes), 50 (topo-sort), 14 (`training.md` dissolves); issues `01-action-catalogue.md`, `14-modules-and-profile.md`, `13-policy-state-split.md`.

---

## Chunk 8 — `garmin.push` (deterministic) + approval chaining

**Goal:** the fully deterministic watch-push, chained off `plan` approval with no second tap and no agent step.

**What it produces:**
- `coach garmin push --profile=… --date=…`: read the approved `plan.yaml`; **delete same-date workouts**; build MCP DTOs from the plan's explicit per-step targets and resolved loads + Garmin enums; upload via the Garmin MCP (`create_strength_workout`, `create_walk_run_workout`/`create_run_workout`, `schedule_workout`); **read back and verify enum survival**; schedule; record workout IDs into the plan/state.
- The **chain**: `plan`'s approval fires `garmin.push` automatically (the approval already happened); the chain is declared as data so every client behaves identically.

**How to verify:** after a `coach run plan` approval, `garmin.push` fires automatically and, against a test Garmin account (or a dry-run MCP), uploads the day's workouts, reads them back, and confirms the enums survived; re-running replaces the same-date workout idempotently; a plan whose schema is complete needs **no** agent step (assert no agent call in the push path).

**Depends on:** Chunk 7.

**Explicitly defers:** the `adjust.day` re-push (chunk 9), n8n auto-firing (chunk 10).

**Governs:** spec §6, §7 (chaining); decisions 01 (garmin.push agent-free + chain), 02 (schema completeness enables it); issues `01-action-catalogue.md`, `02-plan-schema.md`.

---

## Chunk 9 — The rest of the action catalogue (terminal-direct)

**Goal:** complete the seven-action catalogue at the terminal — every logging/adjust action runnable and verified before any driver wraps it, so Telegram and the web app have a full surface to drive.

**What it produces** (each `det`/`agent`/`det` per the catalogue):
- **`meal.confirm`** — `coach nutrition confirm <meal>`: mark the row eaten, roll actual/projected totals. Deterministic; no agent in the way of a tick.
- **`meal.log`** — ingest the described deviation, overwrite the row with actuals, **agent re-tune** the remaining meals to hold the tier (respecting protein distribution + fat floor), write; refresh expected/actual/projected.
- **`session.log`** — source A: pull the Garmin activity + steps; source B (agent): parse what the athlete describes when Garmin didn't capture it; **agent flags** (modified by sleep/pain/heat; deviations vs prescription); write actuals. Writes the store's working loads.
- **`adjust.day`** — ad-hoc input to the **head coach**: load today's plan + a fresh brief; the head coach weighs the input (it may change nothing), then specialists recompute knock-ons (timing shifts, a skipped session re-tiers the day's food down, an ingredient swap re-balances macros); **no gate** — it applies, reports the diff, offers undo. **Propagation is symmetric:** apply re-fires `garmin.push` when the workout changed, and **undo re-pushes the previous workout** — the watch must never disagree with the plan file.
- **`skin.capture`** — `coach skin capture …`: record verbatim, auto-attach the day's objective context from the plan, **agent** infers one or two tags, append to the skin log. (`skin` is a specialist without a coach — capture is mechanical; the weekly correlation stays with the head coach.)
- **`coach.chat`** — free conversation with the head coach, the escape hatch when no command fits. Its **only side-effect channel is invoking the other actions** (`adjust.day`, `session.log`, `meal.log`, a `decide` proposal); it never writes plan/state/policy directly, so the CLI-sole-writer model holds.

**How to verify:** at the terminal — `coach nutrition confirm breakfast` rolls totals with no agent call; `meal.log "had tofu not chicken"` re-tunes and still passes `nutrition validate`; `session.log` from a Garmin fixture writes actuals + updates the store's per-movement load × reps × date rows (the strength coach's progression input); `adjust.day "skipped the run"` re-tiers the day down, reports the diff, and re-pushes the watch — and its **undo restores the plan file and re-pushes the previous workout**; `skin.capture` appends a tagged, context-attached row; a `coach.chat` turn that ends in a change is applied **through** `adjust.day` (assert no direct write from the chat path).

**Depends on:** Chunk 8.

**Explicitly defers:** wrapping any of these in n8n/Telegram/web (chunks 10–12); `decide` (chunk 13).

**Governs:** spec §7 (action catalogue); decisions 01 (`/log` splits; `note`→`adjust.day`; `/body` demoted), 05 (chaining); issues `01-action-catalogue.md`, `09-client-affordance-matrix.md`.

---

## Chunk 10 — n8n wraps the engine

**Goal:** stand up the driver — n8n hosting a per-profile workflow that **exec's the CLI**, with gates as durable Wait nodes and an HTTP API — proving the same `plan` workflow that ran at the terminal now runs remotely and durably.

**What it produces:**
- The **container**: n8n + the `coach` CLI (embedding the SDK) + `garmin-cli` + the Garmin MCP (python/`uv`) + the DuckDB client, base image + `garmin-cli` version pinned together.
- **Custom n8n nodes that EXEC the CLI** (they do not import the library) — one node per action/agent step, passing `--profile`, `--date`, `--resume`.
- The **composed per-profile workflow JSON** for `plan`, topologically sorted from `depends_on`, committed to git (canonical; decision 18/50). Step model/effort declared per step.
- **Gates as n8n Wait nodes**: the execution pauses, sends the prompt, and **resumes on a webhook** any answering surface POSTs. Workflow instance state lives in n8n's execution store (the third kind of state — ephemeral, not committed).
- The **HTTP API** the web app will call.
- The **scheduled-jobs cron set** (n8n owns the clock; deployment is incomplete without it): per-profile **daily Garmin sync**, the **daily DuckDB snapshot**, the **Parquet-store git commit** (the job decision 15's replaceability argument depends on), and the **morning-nudge** trigger scaffold (tuned in chunk 11). `plan` itself stays manual — cron nudges, it never plans.
- The **server commit path**: the container commits `data/<profile>/` changes back to the private remote per change (path-disjoint from logic).

**How to verify:** POST to the n8n HTTP endpoint to start `plan` for `pedro` → the workflow exec's the CLI through decide/lookups/specialists → a Wait node opens for approval → POSTing the resume webhook advances it → `plan.yaml` is written and `garmin.push` chains → the run is visible in n8n's execution log; killing and restarting the container mid-gate preserves the pending gate (re-run at most); the cron set fires on schedule — the daily sync lands, the DuckDB snapshot exists, and the Parquet-store commit reaches the remote.

**Depends on:** Chunk 9 (a complete engine to wrap) and Chunk 0 (remote, host, secrets).

**Explicitly defers:** Telegram I/O (chunk 11), the web app (chunk 12), the `decide` workflow (chunk 13), the second profile (chunk 13).

**Governs:** spec §2, §7 (gates), §13 (container); decisions 44 (n8n driver execs CLI), 41 (Wait-node gates), 45 (two gate modes), 18/50 (workflow JSON, topo-sort); issues `15-durable-workflow-substrate.md`, `08-coach-cli-surface.md`.

---

## Chunk 11 — Telegram driver

**Goal:** the present-tense client — morning nudge, approve/adjust, and logging — over n8n's Telegram node, with the cross-surface gate resume working.

**What it produces:**
- The **Telegram webhook** wired through n8n: secret-token + `chat_id` allowlist (the only public surface; per-profile `chat_id` enforces isolation).
- The **morning nudge**: a cron/notification trigger ("weigh-in + sync landed — plan now?") — the one genuinely-open trigger, tuned here.
- **Approve/adjust** as inline buttons on the pushed plan summary; the DSW `needs-input` gate delivered as a Telegram question (buttons/text).
- **Logging** surfaces: `meal.confirm` (button per meal), `meal.log`/`session.log`/`skin.capture` (free text), `adjust.day` (text; diff render; Undo button).
- **Cross-surface gate resume**: a gate opened by cron and delivered to Telegram is resolved by the button callback POSTing the same resume webhook (or, equivalently, from web/terminal an hour later).
- Rendering **degrades**, not function: a dense plan becomes a summary; `decide` is **absent** on Telegram (the enforced boundary).

**How to verify:** from Telegram — receive the morning nudge, trigger `plan`, receive the summary, tap **Approve** → the plan is written and pushed to the watch; a gate opened by the cron is resolved from a Telegram button tap; `meal.confirm` ticks a meal; `decide` is not offered. A second `chat_id` cannot see the first profile's data.

**Depends on:** Chunk 10.

**Explicitly defers:** the web app (chunk 12); `decide` (chunk 13, and it never appears on Telegram).

**Governs:** spec §10 (Telegram — present-tense); decisions 37 (Telegram public, Mini App dropped), 40 (present-tense scope), 09/46 (affordance matrix, routing), 45 (cross-surface gate); issues `09-client-affordance-matrix.md`, `06-webapp-access-route.md`.

---

## Chunk 12 — Web app (Tailscale): Today, then History, Protocols, Profile

**Goal:** the backoffice — a Tailscale-only, data-dense instrument panel, Today first, then the other three sections mirroring the four data kinds.

**What it produces:**
- **Tailscale-only** serving (Tailscale is the auth; no auth build). Calls the engine through n8n's HTTP API.
- **Today** (first): the instrument panel — a **markers strip** (HRV, sleep, body battery) and a **trailing-load line** above the two answer-cards (session, food, numbers not prose), macro bars in semantic colour, the head coach's reasoning behind a **"Why this shape?"** tap; Approve/Adjust buttons; the DSW gate as a form. Renders directly from `plan.yaml`.
- **History** (trends-first, minimal v1): morning-weight trend, weekly load, adherence as simple charts over the store, with **day drill-down** (prescribed vs actual from the plan's `actual` fields) beneath. The elaborate interactive dashboard stays v2.
- **Protocols**: read policy + `decide` steering (the governed path; web-only).
- **Profile**: goals, races, HR zones, equipment — edited via the governed `decide`-style path (web + terminal), never Telegram; initial creation is a one-time bootstrap.

**How to verify:** on the tailnet, Today renders today's `plan.yaml` with the markers strip, load line, and answer-cards; the reasoning is hidden until tapped; Approve from the web resolves the same gate Telegram could; History shows the three arcs and drills into a day's prescribed-vs-actual; off-tailnet the app is unreachable. The `ui-today.html` prototype is the reference for the Today section.

**Depends on:** Chunk 11 (shared n8n HTTP API + gate plumbing; can also proceed after Chunk 10 if Telegram is deferred).

**Explicitly defers:** the v2 correlation dashboard, full-text/history search, PWA web-push (all out of scope, spec §14).

**Governs:** spec §10 (web app — backoffice); decisions 37 (Tailscale-only), 38 (dense Today), 39 (trends-first history), 40 (sectioned backoffice), 49 (profile via governed path); issues `11-ui-views.md`, `09-client-affordance-matrix.md`.

---

## Chunk 13 — `decide` workflow + second profile / isolation hardening + the girlfriend compose

**Goal:** close v1 — the governed durable-change workflow, then prove the isolation invariant and the plugin contract by standing up a second, structurally different profile.

**What it produces:**
- **The `decide` workflow** (web + terminal only, never Telegram): a **sub-coach proposes** with its derivation → the **head coach mediates** cohesion across domains → the **athlete approves** → the CLI **atomically** appends the coaching-log row **and** applies the policy/profile/override edit. Weekly-by-default cadence with an **ad-hoc escape** for the urgent correction. (Its weekly-recap invocation belongs to the out-of-scope `/week` effort; build the workflow, not the ritual.)
- **A second profile** `data/<partner>/`: its own DuckDB, `chat_id`, overrides — created clean.
- **Isolation hardening**: tests proving no core operation ever reads or writes outside `data/<profile>/`, and that neither profile's surfaces (Telegram `chat_id`, web, store) can see the other's data.
- **The girlfriend compose**: a `plan` workflow for a profile with **head coach + strength + nutrition, no running** — composed by dropping the running plugin, with the head-coach vocabulary shrinking automatically (no hand-editing of any rule).

**How to verify:** a policy edit via `decide` (e.g. adjust a tier floor) appends exactly one coaching-log row and applies the override **atomically** (both or neither), and is refused on Telegram; an isolation test proves profile B's every surface and store read is scoped to `data/partner/` and throws on any `data/pedro/` path; `coach run plan --profile=partner` composes and runs a valid running-less plan whose head-coach rules still fire over the reduced vocabulary.

**Depends on:** Chunk 12 (the web app is where `decide` is surfaced) — the `decide` *engine* can be built after Chunk 9 and surfaced here.

**Explicitly defers:** `/week` (weekly recap + next-week draft, `CONFIRMED`/`ASSUMED` tagging), per-exercise set logging, monthly-reports-as-queries, the v2 dashboard, full-text search, PWA web-push — all out of scope for v1 (spec §14).

**Governs:** spec §7 (durable changes), §4 (profile, plugin contract), §10 (isolation); decisions 29, 30, 31 (`decide` cadence/escape), 32 (plugin contract bar), 12/34/36 (isolation, per-profile data), 14 (girlfriend case); issues `14-modules-and-profile.md`, `05-repo-topology.md`.

---

## Self-Review

**Spec coverage** — every substantive spec section maps to a chunk:

| Spec section | Chunk(s) |
| --- | --- |
| §2 Architecture (CLI = one interface; n8n driver) | 1, 10 |
| §3 Head coach & specialists; per-step model + validators | 5, 6, 7 |
| §4 Plugins & the profile; contract | 2, 5, 6, 13 |
| §5 Four data kinds; files canonical / DuckDB derived | 3, 4 (extractor), 13 (kinds via `decide`) |
| §6 Daily artifact (structured plan + journal) | 3, 7 |
| §7 Actions, workflows, gates, chaining, `decide` | 7, 8, 9, 10, 13 |
| §8 The `coach` CLI (namespaces, gaps, sync, validators, summary, drift control) | 1, 3, 4, 5, 6 |
| §9 Sessions & memory (per-op session model) | 5 (session model), 7 (memory layers via policy/summary reads) |
| §10 Clients (Telegram, web, terminal, isolation) | 9 (terminal), 11, 12, 13 |
| §11 Runtime & billing (SDK, subscription, cost check) | 5 (build-time checks) |
| §12 Garmin access (reads via garmin-cli, writes via MCP, haversine, no pace col) | 4 (reads), 8 (writes) |
| §13 Repo, deployment, three state stores, prerequisites | 0, 1, 10 |
| §14 Out of scope | deferred, listed in 12/13 |
| §15 Open at build time (plugin contract, mobility coach, SDK/cache verify) | 2 (contract), 5 (SDK verify), 7 (mobility note) |

The two-phase brief (map standing decision 3) is realized in Chunk 4 (markers/history pre-built) + the specialist lookups (Chunks 5–6, called after decide). The journal/coaching-log eviction boundary (decisions 10, 27) is implicit in the schema (Chunk 3, `why`-per-element cap) and realized by `decide` appending bounded log rows (Chunk 13); the prose journal itself is written alongside the plan in Chunk 7's write step.

**Granularity note:** Chunk 7 is the heaviest (head coach + runner + full compose). If it over-runs a session, split it: 7a head-coach decide step + policy port; 7b the runner + gates + compose/write. Chunk 9 groups five small actions; it may split into 9a (`meal.confirm`, `meal.log`, `skin.capture`) and 9b (`session.log`, `adjust.day`) if the agent-heavy pair warrants its own review.

**Type consistency:** the plan-schema field names (Chunk 3) are the single contract consumed by the specialists (5, 6), the head coach (7), `garmin.push` (8), the extractor (4), and the web app (12) — all reference the same block names (`decision`, `markers`, `running`/`strength`/`nutrition` with `session`/`meals`, `validate`, `actual`) taken verbatim from the prototype. The validator return shape `{ ok, violations: [{ rule, expected, actual, severity }] }` is fixed in the Global Constraints and reused unchanged in Chunks 5, 6, 7. The output envelope `{ ok, data, gaps, schema_version }` is fixed in Chunk 1 and reused everywhere.

**No implementation code** was written — this is planning only, per the task. Chunks specify test-first intent and the exact verify command/fixture for the deterministic engine parts (3–9) without writing the tests.
