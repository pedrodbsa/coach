# 08 — `coach` CLI/SDK surface

Type: grilling
Status: resolved
Blocked by: 01

## Question

What does the internal `coach` CLI expose?

Standing decision 10 makes this the deterministic substrate of the whole system: the agent's
tool surface is file tools, `coach …`, and the Garmin MCP for workout writes. The command set
falls out of the deterministic steps identified in
[01 — Action catalogue](01-action-catalogue.md), which is why this is blocked on it.

Cover at least:

- **Brief building** — the pre-turn markers and history assembly.
- **Callable lookups** — the two-phase decision from charting: day type to calorie tier, gym
  to available movements with current loads and reps and rotation group. These are called
  *after* the agent has decided, not before.
- **Store queries** — what is a named command versus raw SQL over DuckDB.
- **Sync, and its failure.** Every command force-syncs before reading. `garmin-cli` has an open
  issue on broken sync retry (#18, found by ticket 04), so a failed sync must surface as a
  **loud** gap and switch that read to the MCP fallback — never proceed quietly on yesterday's
  data. Decide where that decision lives: in the CLI, or in the workflow that called it.
- **Writes** — creating and updating the structured plan file, recording actuals.
- **Gate state** — reading and transitioning the durable pause states from decision 9.

**The CLI is where modules expose themselves.** Decision 19 makes each module a vertical slice
owning its data fetch, derived context, policy and state — and its API surface *is* the `coach`
CLI. So the command set is not flat: it is namespaced by module (`coach sleep …`,
`coach running …`, `coach nutrition …`), plus whatever the core owns. Decide how a module
registers its commands, and whether an absent module simply means an absent namespace.

**Validators are part of that surface.** Decision 21 makes a downgraded specialist safe by
checking its output rather than trusting it, so every module whose output is mechanically
checkable needs a `coach <module> validate` command — `nutrition` confirming macros, three
protein boluses over 30 g and the fat floor; `running` confirming every step carries an HR or
pace target. Decide the contract: what a validator returns, whether it distinguishes a hard
failure from a warning, and who acts on the result — the workflow runner re-running or
escalating, or the specialist retrying itself.

**So is a per-domain `summary` (map decision 34).** The head coach never reads raw domain data;
it reads a deterministic `coach <domain> summary`, and its brief is the concatenation of the
active plugins' summaries. Decide what a summary contains, how a domain declares its own data
namespace, and how the Garmin raw store at integration level is projected into each domain
that draws from it. This makes the CLI the boundary of the plugin contract
([14](14-modules-and-profile.md)): register commands, `validate`, `summary`, and the domain's
own data — an absent plugin means an absent namespace, an absent summary, and no contribution
to the head coach's brief.

Then the shape questions:

- Invocation: a CLI the agent calls through `Bash`, an MCP server, or both? The clients also
  need to call it, not just the agent.
- Output format, and how a caller distinguishes a missing value from a zero.
- Gap semantics — the original spec's `gaps` idea, where the builder reports what it could not
  fill and why, rather than silently defaulting.
- **Drift control.** The CLI owns arithmetic and lookups while `protocols/*.md` owns
  thresholds and policy. If `training.md` redefines what counts as a hard session, the CLI's
  `hard_sessions_7d` silently means something else. Decide how the two are kept honest —
  fixtures derived from the protocol text, a version pin, or something better.

## Answer

> **Amended 2026-07-23 by map decision 44** (n8n adopted as driver, refined so the driver
> **execs the CLI** rather than importing the library). Three changes to what follows: (1) the
> **CLI is the single canonical interface** — every driver (n8n custom nodes via exec, the agent
> via `Bash`, the terminal, an ad-hoc Claude Code session) goes through it; there is no separate
> in-process relay. (2) The CLI gains **agent-running commands** (`coach run <coach>`) that wrap
> the SDK internally and return structured JSON. (3) **Gates are n8n Wait nodes**, not a `coach
> gate` command (decision 41). Everything else below — namespacing, named-reads-vs-SQL, output
> contract, gaps, sync-fail-loud, validators, summary, drift control — stands unchanged.

Resolved 2026-07-23. Most of this is composition of prior decisions; the one genuinely new
architectural call is the invocation model.

### Invocation — one core, two entry points (map decision 42)

`coach` is a **core TypeScript library** with a **thin CLI wrapper**. Two callers, two paths:

- **The agent** (Claude Code) shells out to the **CLI** via its `Bash` tool — `coach nutrition
  tier --day-type=quality`, `coach gate resolve …`. This is the agent's deterministic tool
  surface (decision 10) alongside file tools and the Garmin MCP.
- **The relay** (Node/TS, same runtime) imports the **library in-process** — no shelling out to
  itself. The clients never call `coach` directly; they call the relay (decision 05), which uses
  the library.

Not an MCP server: the deterministic surface is for the agent's `Bash` and the relay's code,
not a model-facing tool protocol. The Garmin MCP stays MCP because it is a third-party server;
`coach` is first-party code.

### Command taxonomy — namespaced by plugin

`coach <domain> <verb>` for everything a plugin owns; a small **core** namespace for
cross-cutting machinery. An absent plugin means an absent namespace (decision 32).

| Namespace | Commands (illustrative) | Notes |
| --- | --- | --- |
| `coach <domain>` | `summary`, `validate`, `lookup …`, domain writes | e.g. `nutrition tier`, `strength slice`, `running targets` |
| `coach brief` | `build` | assembles markers + history + per-domain summaries |
| `coach gate` | `open`, `resolve`, `list` | over the per-container SQLite (decision 41) |
| `coach sync` | (force a Garmin sync) | first act of any data command |
| `coach query` | raw SQL escape hatch over the profile DuckDB | for what named commands did not anticipate |

**Named commands vs raw SQL:** the routine, repeatable reads are named (`summary`, the
two-phase lookups, brief fields) so they are testable and stable; `coach query` is the escape
hatch for the unanticipated, matching the spec's "ad-hoc SQL remains available" intent.

### Reads, writes, and the two-phase lookups

- **Reads** are served by the brief and by named per-domain commands. The two-phase decision
  (decision 3) is realised here: markers/history are pre-built into the brief; the
  after-the-decision lookups — `coach nutrition tier --day-type=…`, `coach strength slice
  --gym=…` — are callable commands the agent runs *after* it decides.
- **Writes** go through `coach` too — it is the sole writer of the plan file and actuals
  (decision 24). `meal.confirm` is `coach nutrition confirm <meal>`; the specialist's structured
  JSON is validated and persisted as YAML by the CLI.

### Output contract

- **Structured JSON on stdout**, always — parseable by both the agent and the relay.
- **Missing ≠ zero.** A missing value is `null` **plus a gap entry**; zero is a real `0`. The
  agent must never read an absent field as a default.
- **Gaps are first-class:** every command may emit `gaps: [{ field, reason, action }]`
  (decision from the original brief design). The Garmin DSW is the standing case — endpoint
  empty ⇒ a gap instructing the agent to ask the athlete, not a silent skip.

### Sync and its failure (from ticket 04)

Every data command force-syncs first (`coach sync`). A failed sync is a **loud gap** that
switches that read to the **MCP fallback**, never a silent proceed on stale data —
`garmin-cli` has an open sync-retry bug, so this is load-bearing.

### Validators (map decision 43)

`coach <domain> validate` takes the specialist's proposed output and returns
`{ ok, violations: [{ rule, expected, actual, severity }] }`, where severity is **hard**
(blocks) or **warn** (annotates). On a **hard** failure the **workflow runner** — not the
specialist — acts: it re-runs the step once, then **escalates to a stronger model** (decision
21), then **surfaces to the athlete** as a `needs-input` gate if still failing. This keeps a
downgraded cheap model safe: its output is checked, and failure has a defined ladder rather
than a silent bad write.

### Summary (the head coach's lean context)

`coach <domain> summary` is deterministic (code, not an agent), returning the compact
per-domain digest the head coach reads instead of raw domain data (decision 34). The head
coach's brief = markers + the concatenation of active plugins' summaries. What each summary
contains is a per-plugin definition, part of the plugin contract ([14](14-modules-and-profile.md));
the CLI is where it is registered.

### Drift control

The CLI owns **arithmetic**; policy owns **thresholds**. Kept honest by: (1) the CLI's
definitions (what counts as "hard", how ACWR is computed) **unit-tested against fixtures derived
from the protocol text**; (2) a `schema_version` the command docs pin, so a mismatch is a hard
failure naming both versions (decision from the brief design). A validator's threshold is read
from policy, not hard-coded, so changing a floor in policy changes the check without a code
change.

### Feeds

- [12](12-command-doc-rewrite.md): command docs call these named commands and forbid
  recomputation of anything the CLI owns.
- [09](09-client-affordance-matrix.md): gate commands are what each client's approve/resolve
  affordances drive.
