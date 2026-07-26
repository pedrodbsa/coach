# Remote Coach — The Plugin Seam, and Observations in the Summary

**Date:** 2026-07-25
**Status:** Complete — §1–§3.
**Parent specs:** `2026-07-23-remote-coach-v1-design.md` (the *why*),
`2026-07-23-plugin-contract.md` (the plugin seam) and
`2026-07-25-coaching-loop-and-identity.md` (the coaching loop). Where this document and any parent
disagree, **this one wins for the areas it names** and the parents stand everywhere else; the
superseded passages are listed in §4. Places where the parents are *silent* and this document had to
choose are marked **⚑ contract choice**; §4 collects them with the obligations they create.

> **§1** the plugin has two sides · **§2** `synergies` is engine-side · **§3** observations —
> prose that reaches the head coach · **§4** what this supersedes, and obligations on later chunks.

Two changes, from two different pressures, landing together because both touch the same types.

The first is a **layering** correction. The contract's §2 describes a plugin as a bag of *commands*
that return *envelopes* — a CLI-shaped description of a thing that is not a CLI. Chunk 3's task 3.0
made that concrete and wrong: it put Commander's own flag grammar (`"--date <date>"`) on
`PluginCommand`, which contradicts `program.ts`'s own promise that *"swap Commander for another
parser and the engine is untouched"*, and forced the CLI to construct a plugin — and therefore
resolve a profile — during argument parsing.

The second is a **completeness** correction. Contract §3.2 forbids prose in a `DomainSummary`
outright. That is too absolute: it leaves the head coach unable to distinguish *"volume is low
because the athlete is injured"* from *"volume is low because the athlete is slacking"*, which
demand opposite responses.

---

## 1. The plugin has two sides

*Parent: contract §2.1 (one concrete class per plugin), §2.2 (what a plugin instance receives),
§2.3 (the CLI surface), §3.2 (the summary's shape); design §2 (the engine is framework-independent,
Commander is a thin adapter), §8.*

### 1.1 Decision

**A plugin has an *engine side* and a *CLI binding*. The engine side is domain logic exposing typed
functions that return domain results. The binding is how those functions are reached from a command
line, and it is the only place that knows argv exists.**

```ts
// engine side — knows nothing about CLIs, argv, envelopes or exit codes
interface RunningPlugin {
    summary(input: { date: IsoDate }): Promise<DomainSummary>;
    progress(input: { from: IsoDate; to: IsoDate }): Promise<DomainProgress>;
    validate(input: { block: unknown }): Promise<ValidationResult>;
    trailingLoad(input: { date: IsoDate }): Promise<TrailingLoad>;
}
```

The engine side gets **real parameter types back**. Today `execute(input: unknown)` exists only
because argv has no compile-time shape — `plugins/types.ts` says exactly that. Move the narrowing
into the binding and the domain function can declare what it needs honestly. The narrowing still
happens at the point that knows what it expects; that point simply is not the domain logic.

### 1.2 The binding is CLI-specific, and that is deliberate

**⚑ contract choice.** The binding could have been a transport-neutral input schema that each
adapter renders. It is not, because v1 has exactly one transport: n8n execs the CLI (design §2,
plan Chunk 10), Telegram reaches the engine through n8n, and the web app calls n8n's HTTP API.
A neutral schema would be machinery serving a second adapter that does not exist.

So Commander's grammar is **allowed inside the binding** and forbidden everywhere else. If a second
transport ever appears it gets its own binding beside this one, which is a smaller change than
maintaining an abstraction nobody exercised.

### 1.3 The binding ships with the plugin, not in the core

```
src/plugins/running/
  index.ts    PluginDefinition — key, storeTables, create(storage)     ← engine side
  cli.ts      the verb table: argv shape + which method each verb calls ← integration side
```

Separate *concern*, same *ownership*. If bindings lived under `src/cli/`, adding a domain would
require a core edit and contract §1.9's *"a new plugin registers a namespace and declares its store
tables, with zero core edits"* would be false. Co-located, the bar holds and the transport still
stays out of the engine-side type.

### 1.4 The binding is compile-checked against the plugin

A binding naming a method the class does not have must be a **type error**, not a runtime surprise.
Two files that describe one thing will desync the first time somebody renames a method, and a
convention will not catch it. This is a requirement on the implementation, not a style note.

### 1.5 The envelope leaves the plugin seam

**This reconciles a live inconsistency in the contract rather than introducing one.** §3.2 already
says a summary returns a `DomainSummary` and that *"called as a CLI verb it returns the standard
envelope, `data` being the `DomainSummary` and `gaps` lifted to the envelope's `gaps`"* — the core
wrapping. §2.2 says `execute` returns `Envelope<Output>` — the plugin wrapping. Both shipped.

**§3.2 wins.** A domain function returns a domain result; **the core wraps it into an
`{ ok, data, gaps, schema_version }` envelope**, lifting the result's own gaps. The envelope carries
a `schema_version` and drives an exit code — it is a property of the **CLI boundary**, not of a
domain function.

This is load-bearing beyond tidiness. Under the terminal-direct runner (Chunk 7) the steps pass
typed values in-process and the envelope is applied once, at the outer boundary; under n8n every
step boundary is a fresh process and therefore a real envelope round-trip. The same domain function
serves both only if it is not itself in the envelope business.

### 1.6 Rejected alternatives

1. **A transport-neutral input schema.** Correct in the abstract, and rejected under §1.2: it costs
   a mapping layer to serve a second adapter v1 does not have.
2. **An adapter-owned table in `src/cli/`.** Cleanest separation, rejected because adding a plugin
   would then need a core edit (§1.9).
3. **No declaration at all** — the CLI collects everything after `<namespace> <verb>` into a generic
   bag and the function narrows, raising a gap for what is missing. Genuinely attractive: it is the
   reasoning already in `plugins/types.ts`, it deletes machinery rather than adding it, and it
   produces better gaps than a parser error (`{ field: "date", … }` rather than
   `{ field: "command", reason: "error: missing required argument" }`). **Rejected because it
   silently accepts an unknown flag** — `coach core version --bogus` would exit `0` — which breaks a
   behaviour Chunk 1 verified. Worth revisiting if that clause is ever reopened; the gap-quality
   argument is real and §1.7's second point below is a partial concession to it.

### 1.7 What this buys

- **Parsing needs no profile.** A binding is static data, so the command tree is built without
  constructing a plugin, without a `Storage`, and without resolving a profile. That removes, rather
  than patches, three defects the Chunk 3 review found in task 3.0 as built: a hoisted
  `resolveProfile` that shadowed every routing and parse error, a plugin constructed twice per
  invocation, and two competing sources for the active profile.
- **Gap quality is the binding's job.** Where a missing input is better reported as a
  `{ field, reason, action }` gap than as a parser error, the binding should produce the gap.
  *Missing ≠ zero* applies to command input like anything else.
- **`summary` stays mandatory** (contract §2.3) — as a required **method** on the engine-side
  interface rather than a required key in a command bag. Omission stays a compile error. Likewise
  §4.3's *no coach without a validator*: `CoachDefinition.validate` names a method.

---

## 2. `synergies` is engine-side

Contract §5.1 attaches `synergies` to a *command*. Under §1 it belongs to the **engine-side
function**: it describes a domain function's relationship to other domains, which is domain
metadata, not argv metadata. Nothing else about §5 changes — it remains optional, never a
prerequisite, never an execution edge, and never a storage capability (§5.3).

Noted, because it currently has **no consumer at all**: §5.2 puts hard edges in workflow steps and
the runner's ordering comes from `decision.prescribes[].depends_on`. If Chunk 7.3 builds without
needing it, delete it rather than carrying an unread field.

---

## 3. Observations: the prose that reaches the head coach

*Parent: contract §3.2 (no prose, bounded, facts not verdicts), §3.4, §3.5; amendments §2.2
(designated `notes` fields in the profile kind), §2.3 (the prose rule), §5.4 (`HistoryEntry`),
§6.5 (keep the raw utterance).*

### 3.1 The problem

`running.week_km: 22` against a 30 km floor. The head coach fires the below-floor rule and logs a
corrective action — correct if the athlete was slacking, wrong if they had a calf niggle and backed
off deliberately. Today nothing in the summary can tell those apart.

Often the answer is already structured and cross-domain: `mobility.pain_flags` publishes the calf,
and weighing running's fact against mobility's fact is *exactly* what mediation is for. The gap is
the **idiosyncratic cause no domain owns** — travelling, a broken treadmill, a deliberate easy week
that policy cannot classify.

This is the behavioural analogue of the rule amendments §6.1 already fixed: silence read as
non-compliance.

### 3.2 Decision

**⚑ contract choice. A `DomainSummary` carries `observations: readonly string[]` — one-line,
windowed, capped, and read by an agent only. Nothing in the CLI ever computes with them.**

```ts
export interface DomainSummary {
    readonly namespace: string;
    readonly facts: Readonly<Record<string, JsonFact>>;
    /** Agent-readable context. Never parsed, never computed with, never a fact's only home. */
    readonly observations: readonly string[];
    readonly gaps: readonly Gap[];
}
```

This does not weaken amendments §2.3's prose rule — it satisfies it. The rule forbids a value a
validator checks, a summary computes with, or a lookup resolves from living *only* in prose.
Observations are computed with by nobody. They are colour for the one consumer that can read colour.

### 3.3 They are read, not generated

**The summary never authors an observation.** It selects stored ones, so it stays deterministic:
same profile + date + on-disk state ⇒ byte-identical output (contract §3.1).

The storage already exists — the `HistoryEntry` envelope from amendments §5.4, with a reserved
`kind`:

```ts
{ at, kind: "observation", by: "running", summary: "calf niggle after Sunday — backing off this week",
  payload: { raw: "<the athlete's actual words>" } }
```

`summary` is already specified as *"one line, the same cap as a plan element's `why`"*, which is
exactly the shape wanted. A domain's `observations` is therefore its recent `kind: "observation"`
history rows, filtered by a **policy-declared window** and **capped at a policy-declared count** —
both required, because contract §3.2's *no unbounded values* rule binds this field hardest.

### 3.4 Athlete-sourced only; a specialist petitions instead

**Observations are written by the ingest actions that already run an agent** — `adjust.day`,
`session.log`, `meal.log`, `skin.capture` (design §7). Those steps are already converting an
utterance into structure; emitting a one-line observation alongside is nearly free, and amendments
§6.5 already keeps the raw utterance *"so the coach can read what was actually said rather than what
a cheap model made of it."*

**A specialist coach must not write one.** A `running` coach appending *"volume was low but I judged
that correct"* is advocacy, and it is precisely contract §3.5's third objection to agent-written
summaries: *"it lets a specialist argue."* A domain that wants to influence the day has a channel
already, and it is mediated — a **petition** (§6). Keeping observations athlete-sourced is what
makes them safe to hand over unvalidated.

Stated as one line: **observations are the athlete's voice reaching the head coach, carried by the
domain — never the domain's own voice.**

### 3.5 Transient versus standing

**⚑ contract choice, and the rule that stops this field becoming `current-status.md` again.**

> **Transient → an observation**, windowed, expiring by falling out of the window.
> **Standing → the profile kind**, changed through `decide`.

A six-week injury is not an observation, it is a standing constraint in
`profile/<ns>/profile.yaml`. Without this line, observations accumulate, the head coach's context
grows with the number of days logged, and the summary stops being the context-leanness device it
exists to be (design §3, contract §3.2).

### 3.6 Two weaknesses accepted consciously

- **Duplication.** An athlete mentioning the same calf on Monday, Tuesday and Wednesday produces
  three rows and the head coach over-weights it. The ingest agent should check for an equivalent
  open observation in the window before appending. This is imperfect and is accepted as imperfect.
- **No validator.** Every other agent output is gated by deterministic code — `meal.log`'s re-tune
  must still pass `nutrition validate`. An observation string is unvalidatable by construction, so a
  mis-parse reaches the head coach's premises directly. Mitigations, all required: cap the length,
  retain the raw utterance in `payload`, and keep the source athlete-only so nothing in the system
  can advocate through the channel.

### 3.7 A build-time check: no fact is a bare string

**A summary *fact* may not be a bare string.** Prose lives in `observations` and nowhere else, and a
test asserts it — the same shape as the check amendments §3.2 requires for declared staleness
horizons.

Without it, `note:` fields sprout across fact tables within two chunks and the prose rule is back to
being a convention. With it, there is exactly one place prose can live in a summary, and it is the
one place nothing computes with.

---

## 4. What this supersedes, and obligations on later chunks

### Superseded

| Where | Was | Now |
| --- | --- | --- |
| contract §2.1 | `IPlugin` is a bag of `commands` | an engine-side object of typed domain functions, plus a co-located CLI binding (§1.1, §1.3) |
| contract §2.2 | `PluginCommand.execute(input) → Envelope` | domain functions take typed input and return domain results; the **core** wraps the envelope (§1.5) |
| contract §2.3 | `summary` / `validate` are reserved **verbs** | reserved **methods** on the engine side; the binding maps them to verbs (§1.7) |
| contract §3.2 | `DomainSummary` is `{ namespace, facts, gaps }`; **"No prose"** | plus `observations: readonly string[]` — no prose *the CLI computes with* (§3.2) |
| contract §5.1 | `synergies` belongs to a command | belongs to the engine-side function (§2) |
| amendments §5.4 | `HistoryEntry.kind` is open | plus a reserved `"observation"` value (§3.3) |
| task file `03-0` | `CommandOption.flag` carries Commander syntax on `PluginCommand` | argv grammar lives only in the binding (§1.1–§1.3) |

### Obligations

| § | Choice | Obligation |
| --- | --- | --- |
| 1.1–1.5 | The two-sided plugin seam | **Chunk 2 retro-fit (task 2.7)** — `plugins/types.ts`, `factory.ts`, the dispatch arm of `engine.ts`, the stub, and four test files |
| 1.2 | The binding is CLI-specific | none — a second transport buys its own binding |
| 1.4 | The binding is compile-checked against the plugin | **task 2.7**, asserted by a `// @ts-expect-error` test |
| 1.5 | The core wraps the envelope | **task 2.7**; **Chunk 7.3** relies on it to pass typed values between steps |
| 1.7 | Parsing needs no profile | **Chunk 3.0, rewritten** — supersedes the version already built |
| 2 | `synergies` is engine-side, and unread | **Chunk 7.3** — use it or delete it |
| 3.2 | `observations` on `DomainSummary` | **Chunk 4** (the brief carries them), **Chunks 5–6** (each domain emits them) |
| 3.3 | Read from `kind: "observation"` history rows, windowed and capped | **Chunks 5–6** declare `observation_window_days` and `observation_max` in policy |
| 3.4 | Athlete-sourced only | **Chunk 9** — each ingest action appends one row, raw utterance in `payload` |
| 3.5 | Transient → observation; standing → profile | **Chunks 5–7**, enforced at review rather than by a type |
| 3.6 | Dedup within the window | **Chunk 9** |
| 3.7 | No summary fact is a bare string | **Chunk 4** build-time check, beside the staleness-horizon check |
