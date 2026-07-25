# Remote Coach — Plugin Contract

**Date:** 2026-07-23
**Status:** Complete — §1–§7. **§1 revised 2026-07-23** (propose/promote; see §1.11–§1.12).
**Amended 2026-07-25** by `2026-07-25-coaching-loop-and-identity.md` — the head coach becomes a
plugin, coach identity is added as *logic* rather than a data kind, summary facts gain `as_of`
provenance, a windowed `progress` verb joins `summary`, `HistoryEntry` gains a shared envelope, and
actions gain a completion/logging model. That document's §8 lists exactly which passages below it
supersedes (§1.4, §2.5, §2.6, §3.2); everything else here stands.
Implemented by Chunk 2 tasks 2.2–2.5; §5 and §6 are consumed by Chunk 7, §2.6 by Chunk 13.
**Chunk:** 2 (plan `2026-07-23-remote-coach-v1.md`)
**Parent spec:** `2026-07-23-remote-coach-v1-design.md` — §3 (head coach / specialists), §4
(plugins), §5 (four kinds), §7 (workflows, gates, `decide`), §8 (the CLI), §13 (repo topology).
Where this document and the parent disagree, **the parent wins**; this one only refines what the
parent leaves to the contract. Places where the parent is *silent* and this document had to choose
are marked **⚑ contract choice**; §8 collects them with the obligations they create.

> **§1** storage and data ownership · **§2** registration and the `coach <domain> …` namespace ·
> **§3** the deterministic `summary` · **§4** when a plugin warrants a coach · **§5** synergies ·
> **§6** petitions · **§7** the bar, tested against a household plugin · **§8** obligations on
> later chunks.

---

## 1. Storage and data ownership

> **Revised 2026-07-23** (athlete's call, recorded in §1.12). The original §1 gave the governed
> `decide` path a privileged handle (`GovernedStorage`) and had the **core** write a plugin's
> policy. Both are gone, replaced by **propose → promote**: a plugin can only ever write a
> *proposal*, and the athlete's approval promotes it (§1.11). Subsection numbers are unchanged so
> that §2.2, §3.3 and §7's cross-references still land.

### 1.1 Decision

**The core owns the layout and the access mode; the plugin owns its namespace inside each kind.
No plugin — and no agent — writes live policy. It writes a *proposal*; the athlete's approval
promotes it.**

A plugin never sees a filesystem path. It is handed a `Storage` — one handle per kind, each with a
capability that matches the kind's write rule from §5. Layout, serialisation, atomicity and
containment are the core's problem; *what to put in it* is the plugin's.

### 1.2 Rejected alternative — a scoped folder per plugin

The obvious simpler contract is one rooted directory per plugin (`data/<profile>/plugins/<ns>/`),
free organisation inside. Rejected for three reasons:

1. **It collapses the four kinds into one capability.** §5's split exists so that *"policy and
   profile are read-only to actions"* is mechanically enforceable rather than a per-message
   judgement. A single writable root gives a plugin exactly one capability — *write anywhere under
   my root* — so "no policy edits from Telegram" degrades back to a convention. That is the
   precise class of failure this rebuild exists to remove.
2. **Effective policy spans two trees.** Shipped defaults live in the logic tree (`policy/`,
   builder-authoritative); overrides live under `data/<profile>/policy/` (server-authoritative).
   A plugin-rooted provider sees one half, and the half it cannot write is on the far side of the
   path-disjoint boundary (§13). The merge has to be a core service either way.
3. **The store is profile-level, not plugin-level.** One DuckDB per profile, shared by strength
   loads, Garmin metrics and weight. It does not fit inside a plugin folder.

A fourth reason — *"the head coach needs a cross-plugin read of every plugin's policy"* — is
**retracted (2026-07-23)**. §3.1 fixes the summary as *the only thing the head coach reads from a
domain*, and §3.4 puts threshold application inside the domain, so that read has no caller. The
consequence is stronger than the reason it replaced: **nothing in this system reads across a
namespace.** The three reasons above carry the decision on their own.

Plugin autonomy over *layout* is worth little. Enforcement of *access semantics* is worth a lot.

### 1.3 The tree

Kind at the top level, plugin namespace below it, document beneath that.

```
policy/<ns>/<document>.yaml                    # shipped defaults — builder writes, server never
data/<profile>/
  policy/<ns>/<document>.yaml                  # overrides — only promotion writes these
  profile/<ns>/<document>.yaml                 # HR zones, gym equipment, race calendar
  profile/core/<document>.yaml                 # profile facts owned by no single plugin
  state/<ns>/<document>.yaml                   # overwritten by actions
  history/<ns>/<document>.jsonl                # the coaching log is the head coach's history
  proposals/<ns>/<document>.<id>.yaml          # pending steers — any verb may write one (§1.11)
  logbook/<YYYY-MM>.yaml                       # profile-level, cross-domain — not namespaced
  store/                                       # the per-profile DuckDB
```

Namespace and document ids are validated as **single safe segments** by the same rule as a profile
name (`models/profile.ts`) — no separators, no traversal, no NUL.

### 1.4 Capabilities per kind

| Kind | Written by | Plugin's action-time handle | Semantics |
| --- | --- | --- | --- |
| **Policy** | promotion, after athlete approval | `PolicyReader` | read + **propose**; effective = defaults ⊕ overrides |
| **Profile** | promotion, or setup | `ProfileReader` | read + **propose** |
| **State** | actions, via the CLI | `DocumentStore` | read + whole-document overwrite |
| **History** | the `decide` workflow | `AppendOnlyLog` | append + read; no overwrite, no delete |
| **Proposals** | any verb, via `propose` | *(no direct handle)* | create only; promotion consumes |
| **Logbook** | `log` commands | `DocumentReader` | read-only to plugins; the core owns writes |
| **Store** | `session.log`, the Garmin extractor | `MetricStore` | declared tables only |

The kinds a plugin never touches simply have no method it can call. A non-quantitative plugin
(household, social life) uses policy + state + history and never opens `store` — the contract must
not, and does not, require it to.

### 1.5 The interfaces

```ts
/** What a plugin is handed at action time. Bound to one (profile, namespace). */
export interface Storage {
    readonly namespace: string;
    readonly policy: PolicyReader;      // propose, never write
    readonly profile: ProfileReader;    // ditto
    readonly state: DocumentStore;
    readonly history: AppendOnlyLog;
    readonly logbook: DocumentReader;
    readonly store: MetricStore;
}

/** Binds namespaces and concrete plugin classes' table allowlists to one profile. */
export interface IStorageFactory {
    create(namespace: string, storeTables?: readonly string[]): Storage;
}

export interface DocumentReader {
    read<T>(document: string): Promise<T | null>;
    list(): Promise<string[]>;
}

export interface DocumentStore extends DocumentReader {
    /** Whole-document replace, serialised to YAML, written atomically (temp + rename). */
    write<T>(document: string, value: T): Promise<void>;
}

export interface ProfileReader extends DocumentReader {
    /** Never writes. Creates a pending proposal the athlete may promote (§1.11). */
    propose<T>(document: string, value: T, rationale: ProposalRationale): Promise<ProposalId>;
}

export interface PolicyReader extends ProfileReader {
    /** Effective policy: shipped defaults ⊕ profile overrides, overrides winning. */
    read<T>(document: string): Promise<T | null>;
    /** The layers unmerged, so "why is this value what it is" stays answerable. */
    layers<T>(document: string): Promise<{ defaults: T | null; overrides: T | null }>;
}

export interface AppendOnlyLog {
    append(entry: HistoryEntry): Promise<void>;
    recent(limit: number): Promise<HistoryEntry[]>;
    // Eviction is a core retention job, not a plugin capability.
}
```

**There is no privileged variant of this handle.** The enforcement is no longer "Telegram-originated
actions are given a narrower type"; it is that **no type in the plugin surface can change live
policy at all**. `propose` is therefore safe to hand to every verb, including one reachable from
Telegram: a proposal has no effect until the athlete takes it, and it can be rejected. This is the
same bargain a coding agent makes when it proposes a diff instead of applying one.

Promotion is core-only and lives outside the plugin surface entirely:

```ts
/** Core-only. Called by the `decide` workflow *after* the athlete's approval gate. */
export function promoteProposal(
    profile: string, namespace: string, proposal: ProposalId,
): Promise<PromotionResult>;
```

### 1.6 Cross-plugin reads

A `Storage` addresses one namespace and cannot name another — the parent spec's *"reads only its
own"* falls out of the binding rather than being a rule to obey. A plugin that needs something from
another domain **petitions through the head coach** (§6), phrased as a capability or priority, never
as a read of another plugin's internals.

There is **no cross-namespace read anywhere in the system.** The earlier `CoreStorage.activePolicy()`
— a union read of every active plugin's policy — is **deleted (2026-07-23)**: §3.1 makes the summary
the only thing the head coach reads from a domain, so it had no caller. What crosses a domain
boundary is a *published* thing — a `DomainSummary` (§3), a `Petition` (§6), or a step input the
runner hands over (§5.2) — never a document.

### 1.7 The store is the soft edge — say so

Filesystem containment cannot be leaned on inside a single DuckDB file. `MetricStore` scopes writes
to the tables the plugin **declared at registration** and exposes reads of its own tables; it does
not accept arbitrary SQL from a plugin. Cross-domain quantitative reads go through the brief
(Chunk 4). This is the one kind whose boundary is enforced by declared ownership rather than by the
path scoper — Chunk 4 refines it, and it should not be described as equivalent to the others.

### 1.8 What this does to `resolve`

`infra/storage/scope.ts` stays the single containment chokepoint — it
just stops being a public API. The stores call it; plugins do not.

- `CoachContext.resolve` and `IStorageFactory` are **not** part of the plugin surface. The
  `PluginFactory` passes each plugin the result of `storageFactory.create(namespace, tables)`.
- Core commands may keep using `CoachContext.resolve` for paths no kind covers.
- Nothing in the isolation invariant changes; the proof obligation is still the scoper's tests.

Also unchanged: **the CLI is the only writer**, so the stores are the only code that serialises
YAML, and git commits are the workflow's job — no store method commits anything.

### 1.9 The "slots in without touching the core" bar

A new plugin registers a namespace and declares its store tables. It then has policy defaults,
overrides, profile, state and history immediately, with the correct write rules on each, and zero
core edits. Dropping a plugin drops its namespace and leaves an inert data directory — which is
what makes the second-profile compose in Chunk 13 a deletion rather than a rewrite.

### 1.10 How this is verified (Chunk 2 tests)

- **No live-policy write exists on the plugin surface** — a type-level test (`expectTypeOf`) asserts
  `Storage['policy']` and `Storage['profile']` have no `write`, and that no widening produces one.
- `storage("stub")` resolving a document lands under `data/<profile>/policy/stub/…`; no handle can
  produce a path outside its namespace, and an attempt throws `CoachError` with code
  `PROFILE_SCOPE_VIOLATION`.
- `policy.read` returns defaults when no override file exists, the merge when both exist, and
  `layers()` reports both sides.
- A missing document reads as `null`, never `{}`. The store does **not** manufacture the `Gap` —
  turning "missing" into `{ field, reason, action }` is the calling command's job, because only
  the command knows the field name and the remedy. *Missing ≠ zero* holds at both layers.
- `history.append` leaves earlier entries byte-identical; there is no method that rewrites one.
- **`propose` writes only under `proposals/`** and leaves the live override byte-identical;
  **promotion is the only code path that writes `data/<profile>/policy/`**, and it refuses a
  proposal whose base has moved (§1.11).

### 1.11 Proposals: propose, refine, promote

**⚑ contract choice.** Spec §7 fixes the three parties — proposer, mediator, approver — and that the
change is written atomically with its coaching-log row. It does not fix the mechanism. This does.

#### The flow

```
decide  "easy runs feel too hard"            (web app or terminal — NEVER Telegram)
│
├─ 1 intake     head coach      receives the raw ask (athlete, or a coach's petition)
│                               routes it: this is a `running` matter        writes NOTHING
│
├─ 2 refine     running coach   in : the routed ask + its own policy/profile/history
│                               out: a definitive proposal
│               running's verb  policy.propose("zones", <complete override>, rationale)
│                               → data/<profile>/proposals/running/zones.<id>.yaml
│
├─ 3 mediate    head coach      weigh it against the other domains
│                               approve → step 4 · reject with a reason → back to step 2
│                                                                          writes NOTHING
│
├─ 4 ═══ GATE ═══  the athlete approves, seeing the diff (below)
│
└─ 5 promote    CORE            promoteProposal(...)
                                ├ override ← proposal (temp + rename)
                                └ coaching-log row appended
```

Step 2 is the load-bearing one: **the subcoach composes and persists its own proposal**, because
only it knows whether the change is legal for its domain. The core never authors a plugin's policy.
And "the subcoach persists" means *the plugin's deterministic verb writes it, executed by the CLI* —
the agent still only emits JSON (Global Constraints; spec §6, decision 24).

#### Mediation iterates, but not forever

A rejection at step 3 carries a reason and returns to step 2; the specialist refines and re-proposes.
Each pass appends to the proposal's `rounds[]`, so the negotiation is auditable rather than
overwritten. **After a bounded number of rounds (policy, default 3) without consensus, the workflow
surfaces a `needs-input` gate carrying both positions** — the same ladder the runner uses for a hard
validator failure (Global Constraints). Two agents must not negotiate unbounded: it spends the
budget on a disagreement that a competent human, one gate away, can settle in a sentence.

#### The diff is deterministic; its prose is not

The approval surface shows what actually changes, computed from the layers:

```
current  = mergeLayers(defaults, live override)      easy_cap: 145
proposed = mergeLayers(defaults, proposal)           easy_cap: 138
```

A **cheap model** turns that structural diff into a sentence for the athlete — *"Easy-run HR cap
drops from 145 to 138, because your easy runs have sat about 7 bpm over the cap for six weeks."*
Three rules on it:

- **The structural diff is what is approved and what is logged.** The sentence is presentation. A
  summary that disagrees with the diff is a rendering bug, not a policy change.
- **If the model is unavailable, show the raw diff.** Degrade loudly; never block an approval on a
  summariser being up.
- **Model and effort are workflow-step properties** (spec §3, decision 21), not plugin properties.

#### A proposal is a complete document, never a patch

Promotion replaces the override file wholesale, so a proposal carrying only the changed key would
silently delete every other override in that document. The specialist composes the **complete
post-change override document**. This is the one sharp edge in the design and it is stated here so
no plugin has to discover it.

#### Staleness

The proposal records `based_on` — the override layer it was computed against. Promotion **refuses**
if the live override has moved since, and the athlete re-opens instead of promoting onto a changed
base. Without this, a proposal approved a week late silently reverts whatever landed in between.

#### Atomicity

Promotion writes the override (temp + rename) and appends the coaching-log row. Two files cannot be
renamed as one syscall, so **the unit of atomicity is the git commit** — it contains both or
neither, which is the property auditability actually needs. **⚑ contract choice**; spec §7 says
"written atomically" without fixing the mechanism.

#### Shapes

```ts
export type ProposalId = string;

export interface ProposalRationale {
    /** One sentence, same cap as the plan's per-element `why` (decision 23). */
    readonly why: string;
    /** The derivation, kept for audit; never re-loaded into a later session. */
    readonly derivation?: string;
}

export interface ProposalRound {
    readonly at: string;
    readonly by: "specialist" | "head-coach" | "athlete";
    readonly verdict: "proposed" | "rejected" | "refined" | "approved";
    readonly note: string;
}

export interface ProposalRecord<T = unknown> {
    readonly id: ProposalId;
    readonly namespace: string;
    readonly kind: "policy" | "profile";
    readonly document: string;
    /** The COMPLETE post-change override document. */
    readonly proposed: T;
    /** Staleness guard: the override layer this was computed against. */
    readonly based_on: unknown;
    readonly rationale: ProposalRationale;
    readonly rounds: readonly ProposalRound[];
    readonly created_at: string;
}
```

### 1.12 What this revision replaced

| Removed | Why |
| --- | --- |
| `GovernedStorage` | There is no privileged handle. Nothing in the plugin surface writes live policy, so there is nothing to escalate *from*. |
| `PolicyWriter`, `DocumentWriter` | Same. `propose` replaced both; `DocumentStore` already expressed the state write. |
| `CoreStorage` | Its `forPlugin` was `StorageFactory` under another name; its `activePolicy` had no caller (§1.6). |
| `LogbookReader` | It was `DocumentReader` with `list()` renamed to `months()`. A month *is* a document id. |
| `PluginStorage` (name) | Now `Storage`, produced by `StorageFactory.create`. |

Twelve exported type names became eight, and the core stopped authoring plugin policy. The property
that survives all of it: **an action reachable from Telegram cannot change a coaching rule** — now
because no such method exists anywhere a plugin can reach, rather than because it was handed a
narrower interface.
---

## 2. Registration and the CLI namespace

*Parent: spec §4 (a plugin exposes a `coach <domain> …` namespace), §8 (namespaced by plugin; an
absent plugin is an absent namespace; Commander's plugin model is not used); decisions 19, 32, 42.*

### 2.1 Decision

**There is one concrete class per plugin; a central factory accepts a plugin key, creates its
namespace-bound storage, and constructs that class.**

```ts
export interface PluginCommands {
    readonly summary: PluginCommand<never, unknown>;
    readonly [verb: string]: PluginCommand<never, unknown>;
}

export interface IPlugin {
    readonly key: PluginKey;
    readonly commands: PluginCommands;
}

export class RunningPlugin implements IPlugin {
    /** Static because the factory needs the allowlist before constructing the instance. */
    static readonly storeTables = ["running_activities", "running_splits"] as const;
}

export class PluginFactory {
    constructor(storageFactory: IStorageFactory, activeKeys: readonly PluginKey[]);
    keys(): readonly PluginKey[];
    create(key: PluginKey): IPlugin;
}
```

Nothing else is negotiable at construction: not the path layout (§1.1), not the write rules (§1.4),
not the model or effort a coach runs at (those are workflow-step properties, §4.3). The declaration
is the entire seam between a plugin and the core, which is what makes §1.9's "no core edits" claim
checkable — if adding a domain needs anything not on this type, the contract has failed.

### 2.2 What a plugin instance receives

A plugin command is **not** a `CoachCommand`. The dispatcher passes the requested key to
`PluginFactory`. The factory resolves `Storage` for that key and constructor-injects it into the
concrete plugin class. Individual command calls receive only their parsed input:

```ts
export interface PluginCommand<Input, Output> {
    readonly synergies: readonly PluginKey[];
    execute(input: Input): Promise<Envelope<Output>>;
}
```

Three omissions, each load-bearing:

- **No `resolve`.** §1.8 says the scoper stops being a public API; this is where that becomes true
  rather than aspirational. A plugin has no method that takes a path. **⚑ contract choice** — §1.8
  states the outcome, not the mechanism.
- **No `io`.** Commands never write stdout; the execution layer owns emission (spec §8, Chunk 1).
  For core commands that is a convention; for plugins it is the absence of a sink.
- **No `env`.** A plugin's configuration is **policy**, not environment. Secrets belong to the
  integrations the core calls (Garmin, the SDK), never to a domain.

The resulting plugin cannot widen its capability: it never sees `CoachContext` or `IStorageFactory`,
and its methods close over only the resolved `Storage` instance.

### 2.3 The CLI surface

`coach <namespace> <verb> --profile=… [--date=…]`, exactly as spec §8 prescribes. Three rules:

1. **`summary` is reserved and always present.** Every plugin answers `coach <ns> summary`; it is
   the required member of `PluginCommands`, making omission a type error while keeping dispatch
   uniform with every other command.
2. **`validate` is reserved when it exists.** A plugin that declares a coach must declare a
   `validate` verb (§4.3); one without a coach may still have one.
3. **The agent entrypoint is core-side.** A coach runs as `coach run <namespace>` — in the **core**
   namespace (spec §8: `brief`, `sync`, `query`, `run <coach>`, `resume`), not in the plugin's. The
   runner owns the model, the effort, the retry and the escalation ladder (Global Constraints);
   putting `run` inside the domain namespace would put those knobs inside the domain.

Verbs are single safe segments by the same rule as namespaces (§1.3), so no verb can smuggle a
path fragment into a command name.

### 2.4 An absent plugin is an absent namespace

**Absence is structural, not behavioural.** A plugin that is not in the active set contributes no
Commander node, so `coach cycling targets` fails in *routing* — the same unknown-namespace gap any
typo produces, naming the registered namespaces. There is no registered-but-disabled state, no
plugin-authored "this domain is off" message, and nothing anywhere that enumerates inactive
plugins. A domain the profile does not have is indistinguishable from a domain that was never
written, which is precisely what makes the Chunk 13 compose a deletion (§1.9).

The same rule applies upward: an absent plugin contributes no summary to the brief (§3), no node to
the dependency graph (§5), and no vocabulary to the head coach's rules (spec §4, decision 17).

### 2.5 Plugin keys are explicit

Listing `PluginFactory.keys()` runs **no plugin code** and touches **no filesystem**. Consequences
the implementation must preserve:

- Listing the active plugin keys cannot fail, cannot be
  slow, and cannot depend on a profile's data existing.
- A **duplicate namespace is a startup error naming the collision** — never last-registration-wins.
  A silent override would let a second plugin capture another's data namespace, which is the one
  failure the storage binding (§1.5) cannot catch, because by then the binding is already wrong.
- A namespace colliding with a core namespace (`core`, `brief`, `sync`, `query`, `run`, `resume`)
  is the same error.

### 2.6 Which plugins are active

The active set is a property of the **profile**, not of the build: spec §4 — "a profile selects
plugins". The factory is therefore constructed with a set the caller supplies; it never decides
membership. Chunk 2 passes the installed set (one profile, everything on). Chunk 13 passes the
profile's selection, and `coach running targets --profile=<partner>` becomes an unknown namespace
by §2.4 with no code change.

**⚑ contract choice** — the parent spec does not say where the selection lives or when it is read.
This contract fixes: it is a **profile-kind document** (`profile/core/plugins.yaml`), and the
resolution order is *resolve profile → read selection → build the command tree → parse*. That makes
tree construction profile-dependent, which Chunk 1's single-pass parse is not; the two-phase parse
is Chunk 13's obligation (§8), not Chunk 2's. A missing selection document is a **gap**, not
"activate everything" — *missing ≠ zero* applies to the plugin set as much as to a metric. Core
commands stay reachable while that gap is open, so a profile can always be bootstrapped.

### 2.7 Rejected alternative — plugins that register themselves

The tempting shape is discovery: a plugin directory scanned at boot, each module calling
`register()` on import, à la Commander's own plugin model. Rejected on three counts:

1. **It makes the active set an emergent property of the filesystem.** The active set must be a
   *profile* fact (§2.6); with self-registration, the second profile's compose becomes "delete files
   from the deployment", which is a shared deployment for two people.
2. **Import-time side effects defeat §2.5.** Registration would then run plugin code, so a broken
   plugin breaks `coach core version`.
3. **Spec §8 already forbids it** — Commander parses and dispatches only.

An explicit list of `PluginKey`s buys a set that is chosen, not discovered.

---

## 3. The deterministic `summary`

*Parent: spec §8 (`coach <domain> summary` is deterministic; the brief is the concatenation of
active plugins' summaries), §3 (the head coach never holds a domain's internals), §5, §6 (markers
are facts, never verdicts); decisions 34, 42, 20.*

### 3.1 Decision

**Every plugin exposes exactly one `summary`; it is pure deterministic code, and it is the only
thing the head coach reads from a domain.**

Deterministic means: no Agent SDK, no network, no clock read beyond the `--date` it is given, no
randomness. Same profile + same date + same on-disk state ⇒ byte-identical output. Its inputs are
its own policy, profile, state, history, the logbook and its own store tables (§1.4) — nothing else
is reachable, by §1.6.

### 3.2 Shape

```ts
export type SummaryCommand = (input: { date: IsoDate }) => Promise<DomainSummary>;

export interface DomainSummary {
    readonly namespace: string;
    /** Bounded, prose-free. Values are JSON scalars or small fixed-shape records. */
    readonly facts: Readonly<Record<string, JsonFact>>;
    /** Missing inputs, first-class (§3.3). */
    readonly gaps: readonly Gap[];
}
```

Called as a CLI verb it returns the standard envelope, `data` being the `DomainSummary` and `gaps`
lifted to the envelope's `gaps`. The **brief** (Chunk 4) is the concatenation keyed by namespace —
`Record<namespace, DomainSummary>` — with the union of gaps surfaced at the brief's own level, so
the head coach sees which domain could not answer and why.

Two size rules, both because this is a context-leanness device (spec §3):

- **No unbounded values.** Nothing whose length grows with the number of days logged. "The last
  three hard sessions" is a fact; "every session" is a query, and `coach query` already exists for
  that.
- **No prose.** A summary carries numbers, dates and policy-defined enums. Sentences in a summary
  are reasoning, and reasoning is the head coach's job.

### 3.3 It degrades to gaps; it never fabricates

A summary that cannot compute a fact emits `null` for it **and** a `{ field, reason, action }` gap.
Never `0`, never a policy default silently substituted, never a string like `"unknown"`. This is the
one place in the system where the *store* deliberately does not manufacture the gap (§1.10) but the
*summary* must: the summary knows the field name and the remedy, which is exactly the test §1.10
sets for whose job it is.

A summary must not throw for missing data. If one throws anyway, the brief records a gap for that
namespace and continues — **one plugin's failure cannot take out the brief**, because the head coach
degrading to "I cannot see nutrition today" is a coaching decision it is competent to make, while a
failed `plan` run is not.

### 3.4 Facts, not verdicts

The line, stated so future plugins do not have to guess:

- **Allowed** — anything the CLI can compute from the domain's own data plus its own policy
  thresholds: ACWR, days since the last hard session, protein eaten so far, whether policy classes
  today as a deload week. Policy-defined classification is arithmetic with a threshold read from
  policy (Global Constraints, drift control), not judgement.
- **Not allowed** — readiness verdicts, day-type calls, "should train easy", anything weighing this
  domain against another. That is mediation, and mediation is the head coach's (spec §4).

### 3.5 Rejected alternative — an agent-written summary

Letting each specialist write its own digest is superficially attractive: it reads better and needs
no schema. Rejected:

1. **It makes the head coach's premises non-reproducible.** The same day would brief differently on
   two runs, and drift control (spec §8) has nothing to pin.
2. **It costs N agent calls before the first decision** — on every `plan`, `adjust.day` and nudge —
   for the part of the pipeline that is pure arithmetic.
3. **It lets a specialist argue.** A digest written by the running coach can shade "you are fresh"
   into the head coach's input; a deterministic fact table cannot. The specialist's channel for
   wanting something is a **petition** (§6), which is mediated, rather than a premise, which is not.

---

## 4. When a plugin warrants a coach

*Parent: spec §3 (a coach exists where there is a *how* to decide daily or domain policy to evolve;
`sleep` and `skin` have none), §4 (a plugin *may* have a coach), §7 (`decide`), §15 (whether
`mobility` warrants one is open); plan Chunk 7 (mobility is policy-only in v1); decisions 20, 21,
22, 43.*

### 4.1 The bar

**A plugin warrants a coach when it has a *how* to decide daily, or domain policy to evolve.
Otherwise it has none, and the contract treats that as normal rather than incomplete.**

Both arms are about *derivation*. A domain has a daily *how* when today's answer is computed from
today's circumstances and cannot be enumerated in advance (which session, at which paces, at which
loads). It has policy to evolve when there is a body of domain reasoning that proposes changes to
its own rules — the proposer half of the `decide` workflow.

Failing the bar is the common case, and mis-passing it is expensive: spec §3 records the
2026-07-01 misattribution, where a narrow domain reading of a bad night (balanced HRV read as
training fatigue rather than anxiety) is exactly what a "sleep coach" would have institutionalised.

### 4.2 A coach is optional — the three shapes

| Shape | Declares | v1 examples |
| --- | --- | --- |
| **Coached** | policy, summary, lookups, `validate`, `coach` | `running`, `strength`, `nutrition` |
| **Policy-only** | policy, summary; no commands beyond `summary` | `mobility` |
| **Deterministic-command** | policy, summary, commands; no `coach` | `skin` |

`mobility` is **policy-only for v1** (plan Chunk 7): it contributes prehab policy and pain as a
readiness term, both read by the head coach. Spec §3 guesses it "probably" has a coach and §15
leaves the question open; the plan settles it for v1 as *no coach*. Noted rather than silently
deviated (§4.6) — the parent has not been contradicted, its open item has been closed for v1, and
§4.5 makes reopening it cheap.

### 4.3 What declaring a coach obligates

```ts
export interface CoachDefinition {
    /** The verb in `commands` that checks this coach's output. Required — see below. */
    readonly validate: string;
}
```

- **No coach without a validator.** **⚑ contract choice.** Spec §3 makes "cheap model **plus**
  validator" the reason a downgraded specialist is safe, and the Global Constraints make the runner's
  ladder (re-run → escalate → `needs-input` gate) fire on a hard violation. A coach with no validator
  has no ladder — the failure mode is silent bad output, which is what this rebuild exists to remove.
  A `coach` whose `validate` verb is not in `commands` is a startup error.
- **The coach emits JSON; the CLI persists YAML.** The coach never writes. Its output is validated,
  then written by the core write step (Global Constraints; spec §6, decision 24). Nothing in
  `CoachDefinition` grants a write capability, and `Storage` (§1.5) is the same handle whether
  or not a coach exists.
- **Model and effort are not plugin properties.** They are declared per workflow step, tunable
  without a deploy (spec §3, decision 21). A plugin that pinned its own model would move a tuning
  knob into the domain and out of the workflow.

### 4.4 An agent step inside an action is not a coach

`skin.capture` runs an agent to infer one or two tags (spec §7), and `skin` has no coach (spec §3).
Both are true because a coach is a **registered agent entrypoint that decides *how* for the domain**,
invoked by the runner as `coach run <ns>` and subject to the validator ladder. An agent step inside
an action is the *action's* step, declared by the action, owned by the catalogue. The test is not
"does an LLM appear" but "does this domain decide its own how".

### 4.5 Adding a coach later is additive

`coach` is an optional field. Gaining one adds a `CoachDefinition` and a `validate` verb, and
changes nothing about the namespace, the data layout, the summary, the dependency graph or any
other plugin. This is what makes §15's open mobility question a per-plugin call settled when it is
built, rather than a fork in the contract.

### 4.6 Coach-less plugins and `decide`

Spec §7 describes `decide` as "a **sub-coach** proposes → the head coach mediates → the athlete
approves". Taken literally, a domain with no coach could never change its own policy — which
contradicts §4 allowing coach-less plugins that own policy (mobility ships prehab rules; household
would ship a weekly rhythm). **⚑ contract choice:** for a coach-less plugin the **athlete is the
proposer** and the head coach still mediates. The three-party shape — proposer, mediator, approver —
is preserved with one party doubling up; the atomic append-log-and-apply write (spec §7) is
unchanged. This is a resolution of a silence, not a deviation: no sentence of the parent is
contradicted.

### 4.7 Rejected alternative — a coach per plugin

Giving every plugin a coach is the symmetric-looking design, and it is what the old flat command
set drifted toward. Rejected because it inverts the coaching model: the head coach decides
whether/what precisely because narrow agents systematically over-read their own domain's signal
(spec §3). It also prices a `plan` run at one agent call per registered domain regardless of whether
that domain has anything to decide, and it hands every domain a channel to influence the day that
is not mediated — the exact thing §6 exists to prevent.

---

## 5. Command synergies

*Parent: spec §3 (domains can enrich one another), §6 (the decision block carries the day's actual
ordering), §7 (workflow steps own execution requirements).*

### 5.1 Decision

**`synergies` names plugins that can enrich one command. It is optional metadata, never a
prerequisite, execution edge, or storage capability.**

The metadata belongs to the command because different operations in one domain have different
relationships. A nutrition planning command may benefit from running and strength output while its
summary command does not. If a named plugin is inactive, the command still runs normally.

### 5.2 Hard requirements live in workflows

A genuine execution prerequisite is declared explicitly by the workflow step that requires it.
The decision's per-module ordering remains a fact about that day's plan. Neither is inferred from
`synergies`, so the name cannot accidentally turn an optional integration into availability or
topological ordering semantics.

### 5.3 It is not a capability

`synergies` grants no cross-namespace access. A plugin still receives only its own `Storage`.
Cross-domain information arrives through explicit workflow input, summaries, or petitions.

---

## 6. Petitions

*Parent: spec §4 (cross-domain influence is mediated and phrased in head-coach terms — a capability
or priority, never internals), §3, §7 (`decide` for durable changes); decisions 33, 32, 30.*

### 6.1 Decision

**A coach influences another domain by petitioning the head coach, phrased as a capability or a
priority. It is the only channel, and it is advisory.**

The canonical form from spec §4: the running coach petitions *"the athlete needs posterior-chain
strength work"* — never *"do RDLs at 80 kg"*. The head coach mediates the priority; the target
specialist still owns the *how*.

### 6.2 Why it is the only channel

Not by rule — by construction. §1.6: a `Storage` is bound to one namespace and cannot name
another, so there is no cross-domain read to abuse. §5.3: `synergies` is metadata, not access.
§2.2: a plugin has no path resolver, so it cannot reach a tree it was not handed. The petition is
therefore not the *polite* way to influence another domain, it is the **only** way one exists, and
a plugin that wants a back channel has to change this contract to get one.

### 6.3 Shape and the phrasing rule

```ts
export interface Petition {
    /** The petitioning namespace. Set by the runner from the emitting step, not by the coach. */
    readonly from: string;
    /** A capability or priority, one sentence. Never a prescription, never a domain internal. */
    readonly need: string;
    /** One sentence, same cap as the plan's per-element `why` (decision 23). */
    readonly why: string;
    readonly horizon?: "today" | "this_week" | "this_block";
}
```

**No target field. ⚑ contract choice** — the parent spec does not say whether a petition names its
addressee. It does not. A petition is addressed to the head coach, full stop. A `target` field would
manufacture an expectation of delivery — a work item routed to a domain — and a routed work item is
one refactor away from being a cross-domain command, which is the thing §6.2 spends the whole
storage design preventing. Whatever domain hint is natural lives in the sentence, and the head coach
routes it (or does not).

### 6.4 Mediation is non-binding, and it lands on the next decision

Three legitimate outcomes: the head coach **acts** on it (it becomes an `intent` for a module in a
subsequent `decision`), **defers** it, or **drops** it. There is no acknowledgement, no retry, no
escalation, and a petition never writes anything.

Timing follows from the `plan` shape (spec §7): the head coach decides *first*, then the specialists
run. A petition emitted by a specialist during a run is therefore mediated in the **next** decision —
tomorrow's `plan`, or today's `adjust.day` if it cannot wait. Stated so that nobody builds a
re-entrant decide loop to service one: re-deciding on a specialist's request would hand the
specialist the whether/what call by the back door.

### 6.5 Transient influence versus durable influence

A petition changes at most one day. If a domain wants something to be *true from now on*, that is a
policy change and goes through `decide` (spec §7): proposed with its derivation, mediated by the
head coach, approved by the athlete, written atomically with its coaching-log row. Petition and
`decide` are the same idea at two lifespans, and keeping them distinct is what stops a daily nudge
quietly becoming policy nobody approved.

### 6.6 A coach-less plugin has no petition

Petitions are coach output; a policy-only plugin emits none. Its influence runs through its
**summary facts** and its **policy vocabulary**, both of which the head coach already reads (§3,
decision 17). That is sufficient: "two chores outstanding, one blocking the evening" is a fact the
head coach can weigh, and it needs no channel of its own to be weighed.

### 6.7 Where a petition lives

**⚑ contract choice, and an obligation on Chunk 3.** A petition is emitted in the coach's JSON
output; the runner hands it to the head coach. Since it is mediated on a later decision (§6.4), it
must be persisted in between, and the plan file is the day's record — so the module block carries a
`petitions[]` array. The prototype schema has no such field; the final shape is Chunk 3's call, and
this contract only fixes that it is *in the plan file* rather than in state (petitions are part of
what a day decided, and the plan is what git keeps).

---

## 7. The bar, tested: a household plugin

§1.9 states the bar — *a new plugin registers a namespace and declares its store tables, and gets
the four kinds with the right write rules, with zero core edits*. Spec §4 sets it wider: cycling,
household or social life must slot in, so **non-quantitative domains must not be precluded**. The
test of a contract is whether the least athletic plausible plugin passes it.

**`household`.** Its class declares static `storeTables = []`, no
`coach`, and one verb beyond the mandatory `summary` — say `coach household done <chore>`. Its
shipped defaults (`policy/household/rhythm.yaml`) carry the weekly rhythm; a person's deviations are
overrides under `data/<profile>/policy/household/`, and `policy.read` merges them (§1.4) with
`layers()` still able to answer why Sunday is laundry day. What is outstanding is **state**
(`state/household/outstanding.yaml`), overwritten by `done` through `DocumentStore.write` — an
action writing state, which is exactly the capability an action is allowed (§1.4). It opens
`store` never: `storeTables` is empty and `MetricStore` is simply unused, which §1.4 already
promised would be legal. Its `summary` reads policy and state and returns
`{ outstanding: 2, blocks_evening: true }` — bounded, prose-free facts (§3.2); if the state document
is missing it returns `null` with a gap, not `0` (§3.3). It has **no coach** and this is not a
deficiency: there is no daily *how* to derive (the chore list is enumerable, not computed), so it
fails both arms of §4.1 and sits in the policy-only/deterministic-command shapes of §4.2. It cannot
petition (§6.6) — but it does not need to, because `blocks_evening: true` reaches the head coach
through the brief, where it is weighed against training exactly like any other fact, and the
head coach's rules quantify over it as vocabulary the active plugins registered. When household
policy needs to change ("laundry moves to Saturday"), the athlete proposes and the head coach
mediates through `decide` (§4.6). Removing it later drops a namespace and leaves an inert
`data/<profile>/*/household/` directory (§1.9).

Core edits required: **none**. Lines of core code that know the word "household": **zero**.

---

## 8. Obligations this contract places on later chunks

Every **⚑ contract choice** above, with what it costs whom:

| § | Choice | Obligation |
| --- | --- | --- |
| 2.2 | `PluginFactory` receives only resolved `Storage` | Chunk 2.4 dispatch injects it; 2.5 asserts a plugin cannot reach a path or mint another namespace |
| 2.6 | Active set is a profile-kind document; two-phase parse | **Chunk 13** — Chunk 2 passes the installed set and needs no change |
| 4.3 | No coach without a `validate` verb | Chunk 2.4 startup check; Chunks 5–6 satisfy it by construction |
| 4.6 | For a coach-less plugin, the athlete proposes in `decide` | **Chunk 13** (`decide` workflow) |
| 5.3 | Runner sorts the union of static and per-day edges; day edges only add | **Chunk 7.3** (workflow runner) |
| 5.4 | An inactive dependency drops its edge and is reported in the compose | **Chunk 7.3**, proven by Chunk 13's compose |
| 6.3 | A petition names no target | Chunks 5–6 coach output contracts |
| 6.7 | Petitions persist in the plan file's module block | **Chunk 3** — the plan schema needs a `petitions[]` field the prototype lacks |
| 1.11 | `propose`/`promote`; the subcoach persists its own proposal | **Chunk 13** (`decide`) — Chunk 2 ships `propose` + `promoteProposal` |
| 1.11 | Mediation iterates, bounded, then a `needs-input` gate | **Chunk 13**, reusing the runner's ladder (**Chunk 5.6**) |
| 1.11 | The approval diff is deterministic; a cheap model only narrates it | **Chunk 12** (web app) and **Chunk 13**; falls back to the raw diff |
| 1.11 | Atomicity of promotion is the **git commit**, not a syscall | **Chunk 10.7** (server commit path) and **Chunk 13** |

Two places where the parent spec's own text needed reconciling rather than obeying, both recorded
above and neither a deviation: **mobility's coach** (spec §3 "probably", §15 open, plan Chunk 7
policy-only for v1 — §4.2), and **`decide`'s "sub-coach proposes"** against §4's coach-less plugins
(§4.6).
