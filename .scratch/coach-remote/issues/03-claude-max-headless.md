# 03 — Claude Max, headless, on a server

Type: research
Status: resolved

> Full findings with citations: `../research/03-claude-max-headless.md`

## Question

Can a headless Claude Agent SDK or Claude Code session run on a remote server against the
**Claude Max subscription** rather than API billing?

Establish, from first-party Anthropic documentation rather than from memory:

- The auth mechanism for a long-lived non-interactive session, its lifetime, and how it is
  renewed when it expires.
- Any concurrency or rate limits that bite when the session is driven by a webhook.
- Whether the terms bear on running it unattended on a server the user owns.
- If the subscription route turns out not to be viable: what the API actually costs per
  `/plan` run and per day at realistic token volumes, given the spec's own estimate that
  `/plan` currently makes roughly ten MCP round-trips plus several file reads before it
  reasons.

## Why this blocks

The user's constraint is to leverage the Max plan and avoid API pricing. If that is not
possible, the economics of the whole design change, and it is better to know before the
container is built than after it is deployed.

## Context

- Prefer MCP-backed retrieval (context7, first-party docs) over pretraining for this.
- Note the finding either way, including the negative case — a clear "no" is a useful answer.

## Answer

Resolved 2026-07-22 by background research. Detail and citations in
`../research/03-claude-max-headless.md`.

**Yes, with caveats — but the constraint that prompted the ticket does not hold.**

### The subscription path works, for one client only

`claude setup-token` mints a **one-year OAuth token**, exported as `CLAUDE_CODE_OAUTH_TOKEN`.
Anthropic documents it explicitly for *"CI pipelines, scripts, or other environments where
interactive browser login isn't available"*. It requires a Pro/Max/Team/Enterprise plan, needs
no API billing, and works with locally-configured MCP servers. Running `claude -p` in a
container under cron and webhook is squarely inside the documented use.

### Four caveats, two of which are architectural

1. **Renewal cannot be automated.** `setup-token` opens a browser authorization flow. Once a
   year a human re-mints it on a machine with a browser and updates the server's env var. No
   device-code grant, no refresh grant.
2. **`--bare` mode does not read `CLAUDE_CODE_OAUTH_TOKEN`** — it needs `ANTHROPIC_API_KEY` or
   an `apiKeyHelper`. Anthropic states bare mode "will become the default for `-p` in a future
   release", so the subscription token is at odds with where headless mode is heading.
3. **The Agent SDK gives the opposite answer to the CLI.** SDK documentation says Anthropic
   *"does not allow third party developers to offer claude.ai login or rate limits for their
   products, including agents built on the Claude Agent SDK"*, while a support article says
   Agent SDK and `claude -p` usage *"still draw from your subscription's usage limits"*. The
   contradiction could not be resolved from public sources. **Do not build economics on the
   Agent SDK honouring a subscription.** This directly challenges the original spec's choice of
   `@anthropic-ai/claude-agent-sdk` as the mechanism.
4. **The n8n question stays open, and only Anthropic can close it.** Mechanically it works —
   nothing requires a TTY. Policy-wise there is **no first-party statement** distinguishing a
   third-party tool calling the API with your OAuth token (clearly prohibited) from a
   third-party tool exec'ing Anthropic's own CLI (undocumented). That gap *is* the build-vs-buy
   crux for [15](15-durable-workflow-substrate.md).

### The finding that changes the calculus

**API fallback is roughly $46–77/month — at or below Max 5x at $100/month.** Grounded in this
repo's real file sizes: ~95k final context, ~20 turns, ~1M cache-read tokens, giving about
$1.57 per plan run on Opus 4.8 or $0.94 on Sonnet 5, plus $0.15–0.25 per logging call.

So the premise — *"if the subscription route is not viable, the economics of the whole
architecture change"* — is **false**. Per-token billing for this workload is near break-even
with the subscription, and it buys: no annual manual rotation, `--bare` compatibility, no
policy ambiguity about an external orchestrator, and no quota sharing.

**That last one is a live hazard, not a theoretical one.** Subscription limits are documented
as shared across Claude and Claude Code, so an unattended cron job can consume the pool the
athlete uses interactively — and the failure mode is being locked out of his own coach at the
moment he wants it.

Counterweight: if the Max plan is already paid for interactive use, subscription-backed
automation is free at the margin and API spend is purely additive.

### Gaps the research could not close

- The widely-quoted February 2026 legal language about OAuth tokens does not appear on the
  Consumer Terms, Commercial Terms or Usage Policy pages that were fetched; it circulates only
  through secondary reporting.
- **Anthropic publishes no numeric token limits for Pro/Max**, which is a real planning problem
  for an unattended system. The cheapest way to replace the cost estimate with fact is to run
  `claude -p --output-format json | jq '.total_cost_usd'` over a day of normal use.

### Consequences

- Unblocks [15 — Durable workflow substrate](15-durable-workflow-substrate.md), though caveat 4
  means the n8n policy question cannot be settled by research alone.
- Opens [17 — Agent runtime and billing model](17-agent-runtime-and-billing.md): CLI versus
  SDK, and subscription versus API, are now a real decision rather than an assumption.
- Reinforces [16 — System memory](16-system-memory-layers.md) and
  [13 — Policy/state split](13-policy-state-split.md): the cost estimate is driven by context
  size, and `protocols/current-status.md` alone is 69 KB (~20 KB of it the Coaching Log, 52% of
  the file). Every session pays for that.
