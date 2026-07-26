# How `coach run plan` works internally

**Status:** explanatory notes, **not authority.** The specs in `docs/superpowers/specs/` and the plan
in `docs/superpowers/plans/` decide; this file only draws what they say. Where they disagree with
this page, they win and this page is wrong.

The runner itself is **Chunk 7**; the plugins are Chunks 5–6; storage and registration are Chunk 2
(built). This describes the terminal-direct path — no n8n.

> If the diagrams below render as code blocks, install *Markdown Preview Mermaid Support* in VS Code.

---

## Step kinds: `det`, `agent`, `gate`

Every workflow step is one of three kinds. The notation comes from design spec §7's action
catalogue (`det` preflight → `gate?` → `agent` decide → …).

| Kind | What it is | Properties |
| --- | --- | --- |
| **`det`** | Deterministic pure code. No Agent SDK, no randomness, no clock read beyond the `--date` it is given. | Same profile + date + on-disk state ⇒ byte-identical output. Free, unit-testable, and what drift control pins. |
| **`agent`** | A Claude Agent SDK call. Emits **JSON** — never writes files. | Costs money, non-deterministic. Its output is always validated by a following `det` step. |
| **`gate`** | Pause for a human decision. | Synchronous/inline at the terminal; a durable n8n Wait node when driven remotely. The CLI returns the same structured `awaiting-decision` result either way. |

The architecture deliberately maximises `det` and rations `agent`. That is why `summary` is
deterministic rather than agent-written (contract §3.5), why `garmin.push` needs no agent step at
all, and why the common logging path uses none.

---

## The `plan` workflow

```mermaid
flowchart TD
    classDef det fill:#e6f2ea,stroke:#3f7d5c,color:#12301f
    classDef agent fill:#ece6f7,stroke:#6a4fa3,color:#241640
    classDef gate fill:#fbf0dc,stroke:#a97c1c,color:#3d2c07
    classDef host fill:#e9eef5,stroke:#43607f,color:#16222e

    ARGV["coach run plan --profile=pedro --date=2026-07-25"]

    S1["1 · preflight<br/>force Garmin sync · sync-then-query<br/>failure = LOUD gap, route to MCP fallback"]
    S2["2 · brief build<br/>call every active plugin's summary<br/>compose Record of namespace to DomainSummary<br/>+ markers + computed_at"]
    Q1{"3 · Garmin DSW empty?"}
    G1["3a · GATE needs-input<br/>terminal asks inline"]
    S4["4 · run head — DECIDE<br/>in: brief, petitions, own policy/state, coach query as a tool<br/>out: decision JSON"]
    S5["5 · head validate<br/>every module active · every rule exists<br/>every intent has a checkable acceptance condition"]
    S6["6 · topo-sort<br/>static step edges UNION decision depends_on<br/>inactive plugin drops its edge and is reported"]
    S7["7 · lookups<br/>running targets · strength slice · nutrition tier"]
    S8A["8a · run running<br/>out: session block + petitions"]
    S8B["8b · run strength<br/>out: session block + petitions"]
    S8C["8c · run nutrition<br/>ALSO handed running + strength blocks"]
    S9["9 · validate per domain<br/>ok + violations with severity"]
    Q2{"hard violation?"}
    LAD["LADDER<br/>re-run once, then stronger model,<br/>then needs-input gate"]
    S10["10 · summary — athlete-facing rendering"]
    G2["11 · GATE needs-approval<br/>edit re-enters step 4 and re-opens this gate"]
    S12["12 · write<br/>plan.yaml atomic + journal + state snapshot"]
    S13["13 · garmin.push chains<br/>no second tap, approval already happened"]
    OUT["one envelope on stdout · exit code"]

    ARGV --> S1 --> S2 --> Q1
    Q1 -->|yes| G1
    G1 --> S4
    Q1 -->|no| S4
    S4 --> S5 --> S6 --> S7
    S7 --> S8A
    S7 --> S8B
    S8A --> S8C
    S8B --> S8C
    S8A --> S9
    S8B --> S9
    S8C --> S9
    S9 --> Q2
    Q2 -->|yes| LAD
    LAD --> S4
    Q2 -->|no| S10
    S10 --> G2 --> S12 --> S13 --> OUT

    class ARGV,OUT host
    class S1,S2,S5,S6,S7,S9,S12,S13 det
    class S4,S8A,S8B,S8C,S10 agent
    class G1,G2,LAD gate
```

Note step **8c**: nutrition runs last *and* is handed running's and strength's emitted blocks.
That is one edge doing two jobs — see below.

---

## Who calls whom, and with what

```mermaid
sequenceDiagram
    autonumber
    participant T as Terminal
    participant R as Runner
    participant Rn as running plugin
    participant St as strength plugin
    participant N as nutrition plugin
    participant H as head plugin
    participant SDK as Agent SDK

    T->>R: coach run plan --date=2026-07-25

    Note over R,N: 2 · brief build — det, zero agent calls
    R->>Rn: summary(date)
    Rn-->>R: DomainSummary
    R->>St: summary(date)
    St-->>R: DomainSummary
    R->>N: summary(date)
    N-->>R: DomainSummary
    R->>H: summary(date)
    H-->>R: DomainSummary
    Note over R: composes the brief + computed_at

    Note over R,SDK: 4 · decide — the only step that sees the whole brief
    R->>SDK: prompt = COACH.md + head policy + brief + petitions
    SDK-->>R: decision JSON
    R->>H: validate(decision)
    H-->>R: ok / violations

    Note over R,N: 7 · lookups — det, each reads only its own namespace
    R->>Rn: targets(intent)
    R->>St: slice(gym)
    R->>N: tier(dayType)

    Note over R,SDK: 8 · specialists, in topo order
    R->>SDK: running prompt = COACH.md + policy + ITS intent + acceptance + targets
    SDK-->>R: running session block
    R->>SDK: strength prompt = COACH.md + policy + ITS intent + acceptance + slice
    SDK-->>R: strength session block
    R->>SDK: nutrition prompt = ... + tier + THE TWO SESSION BLOCKS
    SDK-->>R: meals block + petitions

    R->>Rn: validate(block)
    R->>St: validate(block)
    R->>N: validate(block)

    Note over R,T: 11 · approval gate, inline
    R->>T: awaiting-decision
    T-->>R: approve
    Note over R: 12 · writePlan — the sole writer
```

---

## Data flow between plugins: there is none

```mermaid
flowchart LR
    classDef ns fill:#e6f2ea,stroke:#3f7d5c,color:#12301f
    classDef core fill:#e9eef5,stroke:#43607f,color:#16222e
    classDef bad fill:#fbe9e9,stroke:#a63d3d,color:#3d1010

    subgraph store["data/pedro/ — one Storage per profile and namespace"]
        DR[("policy profile state history<br/>running")]
        DS[("policy profile state history<br/>strength")]
        DN[("policy profile state history<br/>nutrition")]
    end

    PR["running plugin"]:::ns
    PS["strength plugin"]:::ns
    PN["nutrition plugin"]:::ns
    RUN["RUNNER<br/>the only holder of more than one namespace"]:::core
    PLAN["plan.yaml"]:::core

    PR --- DR
    PS --- DS
    PN --- DN

    PR -.->|a Storage cannot NAME another namespace| PS
    PS -.->|no cross-namespace read exists anywhere| PN

    PR -->|DomainSummary, session block, Petition| RUN
    PS -->|DomainSummary, session block, Petition| RUN
    PN -->|DomainSummary, meals block, Petition| RUN
    RUN --> PLAN
    PLAN -->|petitions read TOMORROW| RUN
```

Three rules cover every arrow in the system:

1. **Plugin → core** carries only *published* things: a `DomainSummary`, a `Petition`, or the block
   the coach emitted. Never a document, never a handle.
2. **Core → plugin** hands over a `Storage` bound to one namespace at construction, plus whatever
   the step passes at call time. That is the plugin's entire world.
3. **The runner is the only component holding more than one namespace** — and it holds *outputs*,
   never handles.

The dotted arrows are not a convention anybody has to remember. A `Storage` is constructed against
one `(profile, namespace)` pair and exposes no method that accepts another, so the cross-domain read
does not exist to be abused (contract §1.6, §6.2).

---

## `depends_on` does two jobs

`decision.prescribes[]` carries a per-day `depends_on`. In the prototype:

```yaml
- module: nutrition
  intent: tier
  depends_on: [running, strength]   # fuelling needs the sessions first
```

The runner sorts the **union** of the workflow's static edges and the day's decision edges — day
edges only ever *add* — then drops any edge naming an inactive plugin and reports the drop.

That single edge both **sequences** nutrition after the other two **and** tells the runner **what to
hand it**. Cross-domain information is *published and passed*, never read.

Which is what makes the second-profile compose a deletion rather than a rewrite (Chunk 13): drop the
running plugin and the edge simply vanishes — nutrition runs after strength alone, handed one block,
with no rule hand-edited anywhere.

```mermaid
flowchart LR
    subgraph pedro["profile: pedro"]
        R1["running"] --> N1["nutrition"]
        S1["strength"] --> N1
    end
    subgraph partner["profile: partner — no running plugin"]
        S2["strength"] --> N2["nutrition"]
    end
```

---

## Two boundaries the diagrams make concrete

**The envelope appears once.** Terminal-direct, steps 1–12 pass **typed domain values** in-process
and `cli/coach.ts` wraps the result at the very end. Under n8n the same graph costs an envelope
round-trip *per step*, because every node execs the CLI as a fresh process. The envelope is a
property of the **CLI boundary**, not of a domain function — which is why it belongs on the CLI side
of the plugin split rather than on the plugin seam.

**`COACH.md` never touches a plugin.** The runner reads `coaches/<ns>/COACH.md` when composing a
prompt — the same place model and effort are resolved. It appears in no `Storage` handle and no
plugin reads it, which is what makes *"identity is logic, not data"* mechanical rather than a
convention (amendments §2.1).

---

## Where interpretation actually happens

Step 2 being `det` is not magic, and the diagram hides why. **Agents run at the *write* boundary,
never at the read boundary.** Every action that ingests free text has an agent step whose only job is
unstructured → structured, once:

```
"had tofu not chicken"  ──▶ meal.log      agent parses the swap
                                          ──▶ det recomputes macros vs the food table + policy
                                          ──▶ nutrition validate GATES the parse
                                          ──▶ structured row on disk
                                                    │
                            nutrition.summary()  ◀──┘   avg(actual_protein_g) over 7 rows — pure SQL
```

Same for `session.log` (parse what Garmin missed), `skin.capture` (`det` verbatim → `agent` tag →
`det` append) and `coach.chat` (routes into the other actions, never writes directly). Garmin needs
none of it — that data is already structured, so ingestion is arithmetic (haversine for splits, pace
from `avg_speed`).

Two rules make this hold rather than merely usually work:

- **The prose rule** (amendments §2.3): nothing a validator checks, a summary computes with, or a
  lookup resolves may live *only* in prose. The system does not deterministically summarise
  unstructured data — it refuses to keep mechanically-relevant data unstructured.
- **`DomainSummary` is a fact table, not a prose summary.** Bounded, five to ten numbers. "The last
  three hard sessions" is a fact; "every session" is a `query`.

The one prose channel is `observations: string[]` — one-line, windowed and capped by policy, read
from `kind: "observation"` history rows, **athlete-sourced only** (a specialist that wants to
influence the day raises a *petition*, which is mediated). Nothing in the CLI computes with them.
See `2026-07-25-plugin-seam-and-observations.md` §3.
