# 12 — Command doc rewrite

Type: grilling
Status: resolved
Blocked by: 01, 02, 08

## Question

What do the files in `.claude/commands/` become?

Once [01](01-action-catalogue.md) defines each action's steps and [08](08-coach-cli-surface.md)
defines the CLI that performs the mechanical ones, the command docs stop being the whole
recipe. Decide, per command:

- What is **deleted** — the steps that fetched data or derived numbers by hand.
- What becomes a **`coach` CLI call**.
- What **stays as judgement prose**, because it is the reasoning the agent is there for.

The trap the original spec named: adding a "read the brief" step while leaving the old
"compute ACWR" step in place produces two numbers for one quantity in a single session. The
rewrite has to remove those steps, not merely add one.

Also decide:

- How the **terminal client** keeps working from the same docs. If `/plan` at a terminal needs
  the CLI and the store present locally, say so explicitly — it constrains
  [05 — Repo topology](05-repo-topology.md).
- Whether anything mechanically checks that the agent used the brief rather than re-deriving
  a field anyway. The spec suggested asserting that the written day's values match the brief
  that produced them.
- What `AGENTS.md` has to say about all this, given it currently carries a long coaching primer
  that assumes the old shape.

## Answer

Resolved 2026-07-23. Greenfield reframes this: it is not a *rewrite in place* but a
**decomposition** — the old command docs are a content source, and each part lands in its
proper home in the new structure. A monolithic `.claude/commands/plan.md` prose recipe stops
existing; its content splits four ways.

### Where each part of an old command doc goes

| Old command-doc part | New home |
| --- | --- |
| **Orchestration** ("do step 1, then 2, gate, then 3") | the **composed n8n workflow** (per-profile JSON, decisions 18/44/50) |
| **Mechanical steps** ("pull Garmin", "compute ACWR", "build the ledger", "look up the tier") | **`coach` CLI** commands — brief, lookups, validate, writes (decision 42) |
| **Coaching judgement** ("re-derive the week", the readiness tree, the meal-distribution reasoning) | **plugin policy** — head-coach and specialist policy docs the agent reads at `coach run <coach>` (decisions 14/17) |
| **Athlete-specific numbers** (HR ceilings, tiers, gym equipment) | **profile + policy overrides** under `data/<profile>/` (decisions 13/48/49) |

So there is no "command doc" as a recipe any more. There is a workflow (n8n), an engine (CLI),
and policy the agent reasons over. The three clients invoke the workflow (or, at the terminal,
`coach run plan` directly).

### The recomputation trap — structurally prevented

The original worry (a "read the brief" step left beside a "compute ACWR" step → two numbers) is
now prevented by construction, not vigilance: **the agent has no ACWR-computing step to leave
in.** ACWR is a `coach` CLI number the brief carries; the agent cannot recompute it because it
never had the procedure — it has the brief and policy prose, nothing else. The old docs' compute
steps are simply not ported; they became CLI functions (decision 08, drift-controlled by
policy-derived fixtures).

### Mechanical check that the agent used the brief

Kept as a build-time guard: the writer (`coach` CLI, sole writer, decision 24) persists the
plan's derived numbers **from the brief it was handed**, and a test asserts the written day's
values equal the brief that produced them. Because the agent proposes structured output the CLI
validates (decision 02), a re-derived-and-divergent number fails validation rather than landing
silently.

### The terminal path

`/plan` at the terminal becomes `coach run plan --profile=… --date=…` — the CLI (which needs the
store and Garmin access) runs the same engine the n8n workflow calls. A thin `.claude/commands/`
slash-command may still exist as ergonomic sugar that shells `coach run plan`, but it re-encodes
no recipe. This is consistent with decision 05: the terminal is a first-class driver of the CLI.

### `AGENTS.md`

Its long coaching primer is **global-layer policy that belongs to the head coach** (ticket 16),
not a preamble baked into every session. Under the new structure it is loaded as scoped policy
when the head coach runs, not as an always-on prefix. What remains at the repo root is thin:
how the system is laid out and how to drive it, not the coaching brain.

### Migration note (greenfield)

Per the map's build-context note, none of this edits the current repo. The old
`.claude/commands/*.md` and `protocols/*.md` are read as the **source of the coaching logic**,
which is ported into the new repo as: n8n workflows, `coach` CLI code, plugin policy docs, and
`data/pedro/` profile+overrides. The decomposition table above is the porting map.
