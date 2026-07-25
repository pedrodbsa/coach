# Remote Coach v1 — Task Board

This directory is the **dispatchable backlog** for building Remote Coach v1. Each `NN-*.md`
file is a self-contained task you can hand to a fresh agent with no other context — it names its
goal, its inputs, the invariants that bind it, and the exact acceptance criteria.

## Who does what

- **Product owner (this board):** decomposes the plan into agent-sized task files, sets
  acceptance criteria, and reviews output. Writes no production code.
- **You (dispatcher):** pick a task file, hand it to an agent, collect the result.
- **Worker agents:** execute one task file, then report files-changed + test output + deviations.

**Review cadence: every chunk.** After all of a chunk's tasks are done, the chunk is reviewed
against its "How to verify" clause in the plan *before* the next chunk's tasks are dispatched.
Detailed task files are written **one chunk at a time** — the next chunk's files are generated
after the current chunk passes review, so they can harden against what was actually built.

## Source of truth (every agent reads these first)

1. `AGENTS.md` / `CLAUDE.md` — repo rules and the load-bearing invariants.
2. `docs/superpowers/plans/2026-07-23-remote-coach-v1.md` — the plan; each task cites its chunk.
3. `docs/superpowers/specs/2026-07-23-remote-coach-v1-design.md` — the *why* (§ citations).
4. `docs/superpowers/specs/2026-07-23-plugin-contract.md` — the plugin seam: storage kinds and
   write rules, registration, the deterministic `summary`, coaches, synergies, petitions,
   propose→promote. Binding on every task from Chunk 2 onward.
5. `docs/superpowers/specs/2026-07-25-coaching-loop-and-identity.md` — the amendments: head coach
   as a plugin, identity as logic, fact provenance, the `progress` verb, the completion model.
   Its §8 lists exactly which passages of 2–4 it supersedes.
6. Prototypes cited by the plan: `.scratch/coach-remote/prototypes/2026-07-22.plan.yaml`
   (plan schema) and `.scratch/coach-remote/prototypes/ui-today.html` (Today view).

**Precedence:** the design spec beats the plan; the plugin contract refines the design spec where
it is silent; the amendments beat all three **for the areas they name**. A task file written
before an amendment is **not** authority — where a task file and a spec disagree, the spec wins
and the deviation gets reported (task 2.3, for instance, still names `GovernedStorage` and
`CoreStorage`, both deleted by the contract's §1 revision before it was executed).

## Load-bearing invariants (inherited by every task — full list in the plan's Global Constraints)

- **Profile isolation is a hard invariant.** Every core op takes a profile and scopes strictly
  to `data/<profile>/`; it must never cross.
- **The CLI is the only writer of coaching content.** Agents emit JSON; the CLI validates and
  persists YAML. The agent never hand-edits the plan file.
- **Missing ≠ zero.** A missing value is `null` **plus a first-class gap** `{ field, reason,
  action }`; a real zero is `0`. Output is structured JSON on stdout, always.
- **Path-disjoint write authority.** Server writes only `data/<profile>/`; the builder writes
  only logic paths. Effective policy = shipped defaults + per-profile overrides.
- **Test-first** for the deterministic engine parts (schema, validators, brief, lookups,
  drift-control arithmetic). Each such task says so in its **Discipline** line.

Added 2026-07-25 (full text in the plan's Global Constraints, *The coaching loop*):

- **Nothing reads across a namespace** — not even the head coach, which is a plugin whose breadth
  is what a workflow step *hands* it (brief, petitions, `coach query` as a tool).
- **Missing ≠ zero applies to behaviour.** Silence is `unknown`, never `skipped`; unknowns are
  reported beside completions, never folded into a percentage.
- **Prose is agent-readable, CLI-never.** Nothing a validator checks or a summary computes with
  may live only in prose — in a `COACH.md`, a `notes:` field, or anywhere else.
- **Dated facts carry `as_of`**, with staleness horizons declared in policy.
- **Logs are deltas; proposals are whole documents.** Before the fact is an `amend`, after the
  fact is a `report`.

## Model & effort (per task)

Every detailed task file carries a **Recommended agent** (family + specific model) and an
**Effort** (`low` / `medium` / `high`), chosen by task type.

**Guiding preference (athlete's steer):** for **pure code** — implementation, wiring,
deterministic transforms — prefer **Codex**'s coding capability; for **reasoning** — design
judgment, invariant/semantic decisions, adversarial edge cases — prefer **Claude**. When a task
is both, decide by which half is load-bearing.

The rubric:

- **Codex** — pure-code / config-heavy work with a tight spec: scaffolding, boilerplate,
  well-defined wiring, deterministic transforms where the spec removes ambiguity.
  - Models tier **Sol > Terra > Luna**: **Sol** = flagship (deepest/most complex code),
    **Terra** = mid workhorse (default for a real code surface), **Luna** = fast/cheap (trivial
    wiring, throwaway glue). Pick the tier by the task's Effort.
- **Claude** — reasoning: design judgment, invariant/semantic reasoning, adversarial or
  security-sensitive edge cases, and test-first tasks where designing the test *is* the work.
  - Models: **Opus 4.8** for high-judgment / invariant-critical / adversarial tasks (the
    isolation boundary, the validator ladder, the head-coach compose, isolation hardening);
    **Sonnet 5** for solid medium-judgment work in a small surface; **Haiku 4.5** only for
    trivial Claude glue.
- **Effort** scales with judgment/complexity density, not line count: `low` = trivial;
  `medium` = real work in a contained surface; `high` = security-critical, deeply complex, or
  ambiguous reasoning. It selects the Codex tier and sets the Claude thinking budget.

These are reasoned defaults, not benchmarks — override as you learn what each agent does well,
and tell the PO so future chunks are annotated to match.

## The build is (mostly) sequential

Chunks 1→9 (the engine) are a hard dependency chain — a chunk starts only when the previous is
green. Chunks 10→13 (the drivers) branch slightly. **Parallelism lives inside a chunk**, not
across chunks. Within-chunk task ordering (`Depends on` / `Blocks`) is stated in each file.

---

## The board

Legend: **●** detailed task file exists · **○** planned, file written after prior-chunk review.
Status: `todo` / `in-progress` / `review` / `done`.

### Chunk 0 — Prerequisites (manual gate, athlete-owned; no code; blocks deployment ch.10–13)

### Chunk 1 — Repo skeleton, toolchain, CLI entrypoint & output contract  — **status: done** *(reviewed 2026-07-23)*
- ● [1.1](01-1-toolchain-and-skeleton.md) — TypeScript toolchain + two-tree layout + `coach` bin
- ● [1.2](01-2-output-envelope.md) — output envelope type + JSON serializer *(test-first)*
- ● [1.3](01-3-profile-scoper.md) — profile-scoping path helper, throws on escape *(test-first)*
- ● [1.4](01-4-core-version-command.md) — `coach core version` proving the envelope end-to-end

*Review:* all four "How to verify" clauses pass — `core version --profile=pedro` prints a valid
envelope (exit 0); missing `--profile`, an unknown option, and an unknown command each print
exactly one envelope with no Commander prose on stdout (exit 1); the scoper throws on traversal,
crafted profiles, absolute escapes and symlink redirects. `npm test` 50/50, `npm run lint` clean.

### Chunk 2 — Plugin contract sub-spec + storage service + registration  — *depends on 1* — **status: done** *(reviewed 2026-07-25)*
- ● [2.1](02-1-plugin-contract-spec.md) — finish `docs/superpowers/specs/2026-07-23-plugin-contract.md` (§1 drafted)
- ● [2.2](02-2-yaml-codec-and-policy-root.md) — YAML codec + atomic write + shipped-`policy/` resolver *(test-first)*
- ● [2.3](02-3-storage-service.md) — kind-typed stores, defaults ⊕ overrides, profile-bound factory *(test-first)*
- ● [2.4](02-4-plugin-registry.md) — plugin registry + `coach <domain> <verb>` dispatch (unknown namespace errors)
- ● [2.5](02-5-stub-plugin-and-tests.md) — throwaway stub plugin + registration & storage-capability tests *(test-first)*
- ● [2.6](02-6-amendment-retrofit.md) — **2026-07-25 amendment retro-fit**: `HistoryEntry` envelope + `head` reserved & always-active *(test-first)*

*Scope note:* the storage service is an addition to the plan's original Chunk 2 (recorded in the
plan). The YAML codec is pulled forward from Chunk 3 so the stores can be tested against their
real on-disk format; Chunk 3's `writePlan`/`readPlan` reuses it. `MetricStore` is interface-only
here — DuckDB lands in Chunk 4.

*Amendment note (2026-07-25):* tasks 2.1–2.5 were executed against contract §1 as revised on
2026-07-23. The 2026-07-25 amendments landed after, and **2.6 is the only code they change in this
chunk** — everything else they touch is downstream. Chunk 2's review checkpoint ran with 2.6
included.

*Review (2026-07-25):* the plan's whole verify clause passes against the **built** CLI — `stub
summary` routes and returns an envelope; an inactive `stub` is an unknown namespace naming the
survivors; the factory creates the requested class with its namespace-bound storage; no handle
resolves outside its namespace (8 crafted segments × 7 handles, both trees, sibling namespaces).
Chunk 1 regressions all hold. `npm test` **240/240**, build, `typecheck` and `lint` clean.

Two deviations accepted:

- **2.3's type-level test → a runtime capability assertion** (`test/infra/storage/capabilities.test.ts`).
  The specified `expectTypeOf` assertion restates the interface declaration, and interface widening
  is already caught by `tsc` through `implements`. The live risk is *inheritance* — `YamlDocuments`
  is the shared base of `StateDocuments` (which has `write`) and `SteerableDocuments` (which must
  not), so hoisting `write` to the base would leak a writer with **no interface change at all**.
  A type test cannot see that; the prototype-walking runtime test can. Not a strict superset —
  re-typing `Storage['policy']` to `DocumentStore` would still pass — so a three-line
  `// @ts-expect-error` addendum (the form 2.3 and 2.5 both blessed) is recommended, and **contract
  §1.10's first bullet needs amending** to describe what is actually enforced.
- **2.6's mandatory-namespace rule is latent** until Chunk 7 registers `head`. Not really a
  deviation: 2.6 prescribed it, and the amendments' own obligations table assigns enforcement to
  Chunk 13. Gating on the registered set — passed as a parameter — means the armed path is *proved*,
  not trusted.

Open items this review raised, none blocking Chunk 3:

- **`depends_on` was dropped from `PluginDefinition` correctly but unreported.** Contract §5 as
  written replaced it with command-level `synergies`, and the real edges live on
  `decision.prescribes[].depends_on` (per-day), which is what Chunk 7.3 topo-sorts from. Recorded
  here so the deviation is on the board.
- **Contract §8's obligations table cites "§5.3" and "§5.4" subsections that §5 does not have** —
  they survive from the pre-rewrite §5. Fix before **Chunk 7**, where they come due.
- Contract §2.3 says verbs are validated as safe path segments; they are not. Benign today (a verb
  is only ever an object key behind `Object.hasOwn`). Add the check or drop the sentence.
- Contract §3.2's `SummaryCommand → DomainSummary` (core lifts gaps) and §2.2's
  `execute → Envelope` (the plugin lifts its own) need reconciling in **Chunk 4/5**.
- `data/pedro/proposals/` is not scaffolded (created on first write; the other six kinds have a
  `.gitkeep`), and `AGENTS.md` still says no commit has been made.

### Chunk 3 — Plan schema, YAML persistence, first deterministic command  — *depends on 2* — **status: todo**
- ● [3.0](03-0-command-input-seam.md) — **command input seam**: `--date` and positional args, + one envelope on engine-construction failure
- ● [3.1](03-1-plan-schema.md) — plan-schema types (matching the prototype YAML) **+ the 2026-07-25 fields**: `petitions[]` per module block, an acceptance condition per `prescribes[]` intent, brief provenance on the decision, stable `action_id` per athlete-facing action, `at`/`occurred`/`mode` on logged entries *(test-first)*
- ● [3.2](03-2-plan-persistence.md) — `writePlan`/`readPlan` (validate JSON → persist YAML, round-trip stable) *(test-first)*
- ● [3.3](03-3-fixture-store.md) — seeded fixture per-profile DuckDB + read-only `MetricStore`
- ● [3.4](03-4-trailing-load.md) — `coach running trailing-load` / ACWR + drift-control fixtures *(test-first)*
- ● [3.5](03-5-schema-version-pin.md) — `schema_version` mismatch = hard failure naming both versions *(test-first)*

*Ordering:* 3.0, 3.1 and 3.3 are independent and can run in parallel. 3.2 needs 3.1; 3.4 needs 3.0
and 3.3; 3.5 needs 3.1 and 3.2 and closes the chunk.

*Scope note:* **3.0 is new**, not in the plan's Chunk 3 list. It is a prerequisite of the chunk's
own verify clause rather than an addition to it: no command can accept a flag today, and Chunk 3's
clause is `coach running trailing-load --profile=pedro --date=<fixture-date>`. It also carries a
two-line fix for a latent hole where a `CoachEngine` constructor failure escapes `runCli`'s error
handling and prints no envelope at all.

*Scope note:* 3.3 resolves the apparent Chunk 2/3 conflict over `MetricStore` — Chunk 3 implements
**reads** over declared tables so 3.4 has a store; **ingestion and `insert()` stay Chunk 4**, and
`insert()` keeps throwing `METRIC_STORE_UNAVAILABLE`. 3.4 registers a **minimal `running` plugin**
(mandatory `summary` as a gap-returning placeholder, plus `trailing-load`); the real running
specialist is Chunk 6.1.

*Correction carried into 3.2:* the plan's verify clause asks for the **prototype** YAML to round-trip
byte-stably. It cannot — the prototype carries comments and banner blocks, which `toJS()` discards.
3.2 splits it into a structural test against the prototype and a byte-stability test against a
committed normalized fixture.

### Chunk 4 — Brief builder, Garmin reads, loud sync fallback  — *depends on 3*
- ○ 4.1 — `garmin-cli`→DuckDB ingestion + `coach sync` (haversine splits, pace from avg_speed)
- ○ 4.2 — two-phase brief builder (markers + history pre-built; downstream = lookups) **+ `computed_at`**; the brief is the head coach's *handed* input, not a tree it reads
- ○ 4.3 — sync-fail-loud + Garmin MCP fallback
- ○ 4.4 — extractor (plan file → DuckDB, store rebuildable from git)
- ○ 4.5 — **`DatedFact` + policy staleness horizons** *(test-first)*: present-but-old emits value **plus** a staleness gap; a build-time check asserts every dated fact has a declared horizon

### Chunk 5 — Nutrition plugin end-to-end + coach (Agent SDK) + validator ladder  — *depends on 4*
- ○ 5.1 — nutrition default policy port + `data/pedro/` overrides *(restructure, don't copy — no rule survives as prose alone)*
- ○ 5.2 — `coach nutrition summary` *(dated facts carry `as_of` + declared horizons)*
- ○ 5.3 — `coach nutrition validate` (protein boluses, fat floor, iso-with-fattiest, …) *(test-first)*
- ○ 5.4 — two-phase lookups: `nutrition tier` + meal build
- ○ 5.5 — `coach run nutrition` (SDK `query({…})` wrapper) **+ `coaches/nutrition/COACH.md`** identity, runner-composed stable-part-first for the prompt cache
- ○ 5.6 — runner failure-ladder primitive (re-run → escalate → `needs-input` gate)
- ○ 5.7 — SDK build-time checks (subscription login, cost, session/resume/cache TTL)
- ○ 5.8 — **`coach nutrition progress --from --to`** (windowed, deterministic) *(test-first)*
- ○ 5.9 — **`coach nutrition reconcile`** → `{ grade, fidelity, observed, gaps }`, thresholds from policy *(test-first)* — **sets the pattern Chunk 6 mirrors**

### Chunk 6 — Running & strength specialists  — *depends on 5*
- ○ 6.1 — running plugin (policy, summary, validate every-step-target, `targets` lookup, run)
- ○ 6.2 — strength plugin (policy + movement library, loads-in-store, validate, `slice`, run)
- *(each mirrors Chunk 5 in full: `COACH.md` identity, `progress`, `reconcile`, `as_of` + horizons)*

### Chunk 7 — Head coach + workflow runner + full `plan` workflow (terminal)  — *depends on 6*
- ○ 7.1 — head-coach policy port (coaching.md + dissolved training.md) → `policy/head/` + mobility policy-only plugin
- ○ 7.2 — **`head` as a plugin** (`PluginDefinition`, `summary` = standing decision state, `CoachDefinition`, `coaches/head/COACH.md`) + `coach run head` decide step, inputs *handed* to it
- ○ 7.3 — workflow runner (topo-sort from `depends_on`, gates, compose)
- ○ 7.4 — `det` write step (plan.yaml + journal + state snapshot)
- ○ 7.5 — **`coach head validate`**: every prescribed module names an active plugin, every rule cited exists, every intent carries a checkable acceptance condition
- *(plan notes a 7a/7b split if it over-runs)*

### Chunk 8 — `garmin.push` (deterministic) + approval chaining  — *depends on 7*
- ○ 8.1 — `coach garmin push` (DTOs, delete same-date, upload, read-back enum verify, schedule, record IDs)
- ○ 8.2 — approval→push chain declared as data

### Chunk 9 — Rest of the action catalogue (terminal-direct)  — *depends on 8*
- ○ 9.0 — **the core logging channel**: one athlete-facing entry point, `action_id` targeting, `amend`-vs-`report` defaulted from the action window, delta semantics, raw utterance retained *(test-first — this binds 9.1–9.6)*
- ○ 9.1 — `meal.confirm` · 9.2 — `meal.log` · 9.3 — `session.log`
- ○ 9.4 — `adjust.day` (+ symmetric propagation & undo re-push) · 9.5 — `skin.capture` · 9.6 — `coach.chat`
- ○ 9.7 — **unknown-closure**: an unreported action closes as `unknown` after a policy window, permanently, and never becomes `skipped`
- *(plan notes a 9a/9b split option)*

### Chunk 10 — n8n wraps the engine  — *depends on 9 + 0*
- ○ 10.1 container · 10.2 exec-CLI nodes · 10.3 composed `plan` workflow JSON · 10.4 Wait-node gates + resume webhook · 10.5 HTTP API · 10.6 cron set · 10.7 server commit path

### Chunk 11 — Telegram driver  — *depends on 10*
- ○ 11.1 webhook (secret + allowlist) · 11.2 morning nudge · 11.3 approve/adjust + DSW gate · 11.4 logging surfaces · 11.5 cross-surface gate resume · 11.6 degrade + decide-absent

### Chunk 12 — Web app (Tailscale): Today, History, Protocols, Profile  — *depends on 11 (or 10)*
- ○ 12.1 Tailscale serving · 12.2 Today · 12.3 History (reads `progress`; unknowns beside completions) · 12.4 Protocols · 12.5 Profile
- ○ 12.6 — **weekly review surface**: interprets `progress` facts (never recomputes them) and digests proposals raised **and rejected, with reasons**

### Chunk 13 — `decide` workflow + second profile / isolation hardening + girlfriend compose  — *depends on 12*
- ○ 13.1 `decide` workflow (propose→mediate→gate→promote; bounded rounds then `needs-input`; stale-base refusal; git commit = atomicity; athlete proposes for coach-less plugins; rejections retained)
- ○ 13.2 second profile · 13.3 isolation hardening tests
- ○ 13.4 girlfriend compose (drop running plugin) + **two-phase parse** from `profile/core/plugins.yaml`; missing selection is a gap; `head` exempt and always active

---

## Task file conventions

Every task file carries: **Chunk**, **Depends on** / **Blocks**, **Discipline** (test-first or
not), **Context**, **Goal**, **Deliverables**, **Inherited invariants that bind this task**,
**Acceptance criteria** (a checklist; the last item is always `npm test` green where a harness
exists), **Out of scope**, and **Definition of done** (what the agent reports back).
