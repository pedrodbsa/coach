# 15 — Durable workflow substrate

Type: research
Status: resolved

> **Narrowed by [17](17-agent-runtime-and-billing.md) (2026-07-23).** The agent runs in our own
> relay via the Agent SDK on subscription login — first-person use, not a third-party tool
> exec'ing the CLI. So the n8n policy ambiguity that dominated this ticket is **moot for the
> chosen path**: we are not using an external orchestrator to drive the agent at all. What
> remains is a pure question of what holds durable workflow and gate state — a library or a
> table — with no LLM-orchestration or auth-policy dimension. The build-vs-buy section below is
> largely settled toward bespoke; the live question is which durable-state mechanism.

## Question

What carries workflow state, so that it is not hand-rolled?

The requirement is small but genuinely durable. Seven workflows. Steps are function calls. A
gate is a row: status, typed prompt, nonce, target date. Chaining is a declared successor. What
makes it non-trivial is that it must survive a process restart, resume days later, be
resolvable from a different client than the one that opened it, and never lose an in-flight
action.

Establish, from package registries and first-party documentation rather than from memory:

- What TypeScript/Node libraries cover durable state machines or durable execution at this
  scale — the space includes state-machine libraries, durable-execution frameworks, and job
  queues backed by a table. Name the real candidates and their actual maturity.
- For each: what it costs to run (a database? a server? a hosted service?), whether it works
  inside a single container alongside Node, the `claude` CLI, python/`uv`, `garmin-cli` and
  DuckDB, and whether it can be self-hosted with no external dependency.
- Whether any of them handle the awkward requirement directly: a workflow that **pauses
  indefinitely** awaiting a typed human answer, resumable by an arbitrary client.
- Whether the honest answer is "a table and a switch statement", and if so, say that plainly.
  A few hundred lines of tested TypeScript can beat a dependency that has to be fed a
  database.

## Build versus buy — evaluate an external orchestrator too

Three objections to n8n were raised on 2026-07-22 and **two were withdrawn the same day**.
Record them as withdrawn so they are not recycled as reasons:

- ~~"Workflows are computed, not drawn"~~ — **withdrawn.** Composition happens once, at setup
  or profile change, not per run. A generated graph, materialised as JSON and committed, is
  entirely workable, and a reasoning node returning a branch key covers the dynamic parts.
- ~~"The agent step needs token streaming"~~ — **withdrawn.** The athlete does not want the
  stream. What is wanted is *what to do*, plus optionally *why*. So the agent's output is a
  structured result, and a request/response node is sufficient for workflow actions.
- ~~"It splits the source of truth"~~ — **withdrawn.** Workflow JSON can live in git and be
  pushed to the tool.

**The one that stands, and it is the primary filter:** the reasoning must run as Claude Code
against the **Max subscription**, not an API key. Any platform whose value is its own LLM
orchestration layer wants an API key and puts the reasoning on API billing.

- **Dify** — assessed and rejected on that basis. Its value *is* the model-provider, agent-node
  and RAG layer, which is exactly the part that cannot be outsourced here: the brain is a
  Claude Code session with file tools over this repo, authenticated by subscription. Using it
  would mean re-implementing the agent loop inside Dify, on API pricing, while using a small
  fraction of the platform.
- **n8n** — genuinely open. It can shell out to the `claude` CLI from a command node, which
  preserves subscription auth, and call the `coach` CLI for the deterministic steps. Evaluate
  it properly rather than dismissing it.
- **Bespoke** — still the simplest thing that could work, for the sizing reasons above.

So the research must answer, in order:

1. Can an external orchestrator drive Claude Code on the Max subscription at all? (This is
   [03 — Claude Max, headless, on a server](03-claude-max-headless.md); hence the block.)
2. If yes, does n8n's durable-wait model actually cover an indefinite human gate resolvable by
   an arbitrary client, and what does it cost to run alongside the rest of the container?
3. If no, or if the cost is disproportionate, what library carries the state — or is it a
   table and a switch statement?

## Context

- Standing decisions 9, 11 and 12 on the map.
- Constrains [08 — coach CLI/SDK surface](08-coach-cli-surface.md): whatever holds gate state
  is what the CLI's gate commands read and write.

## Answer

> **Superseded later the same day (2026-07-23) by map decision 44.** n8n was reconsidered and
> adopted as the orchestration **driver** (custom TS nodes import the core in-process). So
> workflow instance state and gates now live in **n8n's execution engine** — a gate is a **Wait
> node** resumed by a webhook — not the bespoke SQLite runner below. The rest of this answer's
> reasoning (three kinds of state; workflow state is not coaching data; a framework is overkill)
> still holds; only the *owner* of that third state changed from our SQLite to n8n's store.

Resolved 2026-07-23 as a design decision, not a research task — [17](17-agent-runtime-and-billing.md)
removed the LLM-orchestration and auth-policy dimensions, leaving a well-understood pattern.

**A table and a switch — the table is embedded SQLite, and it is a third store, distinct from
the two already decided.**

### Definitions versus instance state

Workflow *definitions* — the composed step graphs — are already decided: declared in a document
the head coach owns ([14](14-modules-and-profile.md) / decision 18), part of the logic tree, in
git, static. This ticket is only about workflow **instance state**: which instance is at which
step, which gates are pending, their nonces and typed prompts.

### Why not the DuckDB, why not a framework

Instance state is **transactional operational state** — frequent small updates, concurrency
between the cron job and a chat message, and ephemeral. That is the wrong shape for the
per-profile **DuckDB** (decision 34), which is analytical (columnar, single-writer, built for
aggregate queries) and **git-committed**: putting an in-flight approval nonce there would lock
the analytical store for transactional writes and commit ephemeral machinery to git history.

A **durable-execution framework** (Temporal, DBOS, BullMQ, Inngest) is overkill for seven
workflow types and a handful of instances a day, single-user — each wants a server or a
Redis/Postgres, disproportionate for a single-container, git-as-truth system. n8n and external
orchestrators are **rejected**, not merely moot: beyond the auth point ticket 17 settled, the
whole orchestration stack is bespoke TypeScript end-to-end so the Agent SDK, the `coach` CLI and
the gate state share one runtime (map decision 44). n8n would fight composed-from-config
workflows (14), the SQLite-sized state, the N-container multi-profile model (12), and
git-as-truth (18).

### The store

**Embedded SQLite, one per container, on the volume, not git-committed.** The canonical
embedded OLTP store: survives restart, resumes days later, handles cron+chat concurrency, zero
external dependency, one file. The pause-indefinitely / resolve-from-any-client requirement is
trivial — a gate is a row any client resolves via `coach gate resolve <id> …`, and the CLI
(sole writer, decision 24) updates the row and advances the workflow. The relay recovers
in-flight state by reading pending gates on startup.

### Recovery model — three kinds of state, cleanly separated

| State | Store | Git | If lost |
| --- | --- | --- | --- |
| Coaching record (plans, logs, policy overrides) | files under `data/<profile>/` | committed, canonical | nothing lost |
| Quantitative history | per-profile DuckDB | daily snapshot | rebuilt from Garmin + extractor |
| **Workflow instance state** | **per-container SQLite** | **not committed — ephemeral** | re-run the workflow; no coaching data lost |

The coaching *record* is durable and canonical; the workflow *machinery* is ephemeral. Losing
the SQLite (a container rebuild without volume) costs at most an in-flight plan that is simply
re-run — no coaching data is at risk.

### Feeds

- [08](08-coach-cli-surface.md): the CLI's gate commands (`gate open`, `gate resolve`,
  `gate list`) read and write this SQLite; it is the store behind the gate surface.
- A lightweight state-machine helper library for the switch itself is a build-time convenience,
  not an architecture decision — the store and the model are what this ticket fixes.
