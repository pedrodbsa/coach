# 17 — Agent runtime and billing model

Type: grilling
Status: resolved

## Question

Two coupled decisions that [03](03-claude-max-headless.md) turned from assumptions into open
choices.

### Which runtime drives the reasoning?

- **`claude -p` (the CLI)** — the subscription token is documented for exactly this. But
  `--bare`, which Anthropic says will become the default for `-p`, does **not** read
  `CLAUDE_CODE_OAUTH_TOKEN`. So the supported path today is on a deprecation trajectory.
- **`@anthropic-ai/claude-agent-sdk`** — what the original spec chose, and much the nicer
  programmatic interface for a relay that has to stream, resume sessions and supply MCP
  servers. But its own documentation says third-party developers may not offer claude.ai login
  or rate limits for products built on it, while a support article says SDK usage draws from
  subscription limits. Unresolved from public sources.

The two are not interchangeable: the CLI is a process to exec, the SDK is a library to call.
Session resume, MCP wiring, tool permissions and structured output all differ.

### Which billing model?

- **Subscription** — free at the margin if the Max plan is already paid for interactive use.
  Costs an annual manual token re-mint on a browser-capable machine, and **shares the quota
  pool with interactive use**, so an unattended cron can lock the athlete out of his own coach.
- **API key** — roughly $46–77/month by the ticket 03 estimate, at or below Max 5x. Buys
  `--bare` compatibility, no annual rotation, no policy ambiguity about an external
  orchestrator, and an isolated quota. Purely additive spend on top of a plan already paid for.

### Decide

- Runtime: CLI, SDK, or an abstraction thin enough to swap.
- Billing: subscription, API, or subscription-with-API-fallback — and if the last, what
  triggers the fallback and how the athlete finds out it fired.
- Whether it is worth asking Anthropic support directly about the orchestrator question, since
  caveat 4 of ticket 03 cannot be closed any other way.
- Whether to spend a day measuring actual cost with
  `claude -p --output-format json | jq '.total_cost_usd'` before choosing. The estimate carries
  a ±2× band and there is no published Pro/Max token limit to plan against.

## Context

- The original spec's Agent SDK choice was made before any of this was known. It is not
  obviously wrong, but it is no longer a settled premise.
- Constrains [15 — Durable workflow substrate](15-durable-workflow-substrate.md): an external
  orchestrator on a subscription is the undocumented case, whereas an external orchestrator on
  an API key is unambiguous.
- Interacts with [16 — System memory](16-system-memory-layers.md): under API billing, context
  size becomes a line item, so leaner sessions are worth money rather than merely being tidy.

## Answer

Resolved 2026-07-23.

### Runtime: the Agent SDK, and it is decided by the architecture, not by auth

The spec's assumption of one Claude Code session loading all project settings is gone. The
design is many **scoped** agents — head coach plus per-domain sub-coaches, each with its own
model and effort (decision 21), its own scoped context (decisions 26 and 34), some downgraded
behind validators. That wants **per-call programmatic control** — `query({ model, systemPrompt,
mcpServers, allowedTools })` — which is the Agent SDK. Constructing scoped context per
invocation through CLI flags would be fighting the tool.

### Billing: no forced API pricing — corrected by a first-party source

The earlier position (lean API for isolation) was **withdrawn** after the athlete supplied the
decisive first-party article. Reconciled from three sources:

- **First-party** ([support.claude.com/en/articles/15036540](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)):
  the Agent SDK works with Pro/Max via **subscription login, not an API key**. This resolves
  ticket 03's caveat 3, where secondary sources contradicted each other. The credit is
  described as sized for "individual experimentation and **automation**" — this use is named,
  not excluded.
- **Designed model** (June 15 2026): a separate monthly Agent SDK credit — $20 Pro / $100 Max
  5x / $200 Max 20x — drawn before any other source, overflowing to API rates *only if the
  athlete opts into usage credits*. So no surprise API billing.
- **Current model**: the change is **paused** — "nothing has changed… Claude Agent SDK still
  draws from your subscription's usage limits." So today it draws the shared interactive pool;
  when the split activates it becomes a dedicated pool.

Two corrections to earlier reasoning that this forces:

1. **The "shared-quota lockout" objection is at worst temporary.** The designed model
   *separates* the SDK pool from interactive use, which is the isolation I had wrongly credited
   only to API keys. Under the current paused state the pool is shared, so an unattended cron
   does draw interactive limit — but the workload is modest (one plan plus a few logs a day) and
   the athlete controls when the cron runs.
2. **On Max 5x the workload plausibly runs inside the included budget.** ~$46–77/mo estimated
   against a $100/mo credit — near-free, and money already spent on the plan, not additive.

### Decision

- **Runtime: Agent SDK.** Firm.
- **Auth: a swappable credential, defaulting to subscription login.** The relay authenticates
  the SDK from configured credentials; the code does not care which. Subscription is the
  default because it is confirmed to work and carries no API cost in either the current or the
  future model. An API key stays a one-line config swap if the athlete ever wants a hard
  isolation boundary or outgrows the credit.
- **Do not opt into usage credits** unless a hard cap on spend is explicitly wanted — that is
  the only path to a surprise bill.
- **Verify at build time** which model is live on the account (`claude -p --output-format json
  | jq '.total_cost_usd'` for a real day, plus the console usage page). The tier choice (Pro
  $20 vs Max 5x $100) is an ops decision sized to measured usage, not an architecture blocker.

### Consequences

- **Unblocks [15](15-durable-workflow-substrate.md), and narrows it.** The agent is driven by
  our own relay through the SDK on subscription login — first-person use, not a third-party
  tool. So the n8n policy ambiguity (a third party exec'ing the CLI) is moot for the chosen
  path. Ticket 15 collapses to a pure "what holds durable workflow and gate state" question — a
  library or a table — with no LLM-orchestration or auth-policy dimension left.
- Resolves the open contradiction flagged in [03](03-claude-max-headless.md) caveat 3.
- Corrects the original spec, which named `@anthropic-ai/claude-agent-sdk` but left billing
  unresolved and implicitly assumed one monolithic session.
