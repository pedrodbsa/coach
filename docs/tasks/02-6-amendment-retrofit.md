# Task 2.6 — Amendment retro-fit: history envelope + `head` reserved and always active

**Chunk:** 2 — Plugin contract sub-spec + storage service + registration
**Depends on:** 2.3 (storage service) and 2.4 (plugin registry), both built.
**Blocks:** Chunk 2's review checkpoint, and therefore Chunk 3.
**Discipline:** **Test-first (TDD).** Both changes are enforcement, not feature — write the failing
assertions first.
**Recommended agent:** **Claude** — model **Sonnet 5** · **Effort:** medium — a contained surface
with decided semantics, but it touches the registry's collision rules, which are invariant-adjacent.

## Context

Read `AGENTS.md`, the plan's **Chunk 2** and **Global Constraints** (including the
*Added 2026-07-25 — the coaching loop* block), and — as this task's specification —
`docs/superpowers/specs/2026-07-25-coaching-loop-and-identity.md` **§1.1–§1.2** and **§5.4**.

Tasks 2.1–2.5 were executed against contract §1 as revised 2026-07-23. The 2026-07-25 amendments
landed after them. **This is the only Chunk 2 code they change**; everything else they touch is
downstream (Chunks 3–13, mapped in the plan's amendment-coverage table).

Do not build the head coach here. This task **reserves its namespace**; Chunk 7 builds the plugin.

## Goal

Two enforcement points land before anything is built on top of them: history rows share a shape
that a later cross-namespace `coach query` can rely on, and no profile can ever exist without a
head coach.

## Deliverables

### 1. The shared `HistoryEntry` envelope (amendments §5.4)

In `src/infra/storage/types.ts`, replace `{ at, [field]: unknown }` with a required core plus an
open payload:

```ts
export interface HistoryEntry {
    readonly at: string;            // ISO, from the run's clock
    readonly kind: string;          // "decision" | "promotion" | domain-defined
    readonly by: string;            // the namespace or party that appended it
    readonly summary: string;       // one line, the same cap as a plan element's `why`
    readonly payload?: Record<string, unknown>;
}
```

The open index signature goes away — that is the point. Domain-specific fields move into
`payload`, so a core-side query can filter on `kind`/`by`/`at` across namespaces without every
domain having invented its own row shape.

A comment must record the *why*: the envelope serves **core-side** `coach query` (contract §1.6 —
plugins still cannot read another namespace), and files stay canonical while DuckDB is derived, so
projecting this envelope into a `decisions` table is Chunk 4's option, not a dependency.

### 2. `head` reserved and always active (amendments §1.2)

In the plugin registry:

- Declare `MANDATORY_NAMESPACES = ["head"]` — the namespaces a profile may not switch off. Do
  **not** add `head` to `CORE_NAMESPACES`: those names are reserved *against* plugins, and `head`
  is the head coach plugin's own namespace, so reserving it core-side would reject its registration
  in Chunk 7. (Two plugins claiming it is structurally impossible anyway — the registry is keyed by
  namespace.)
- Add the **always-active exemption**: a resolved active set omitting a mandatory namespace is a
  startup error naming it, not a silent repair.
- The rule is **latent until Chunk 7 registers `head`** — requiring a namespace no
  `PluginDefinition` exists for would fail every call today for a plugin nobody has written. Gate it
  on what the build can construct, and take the registered set as a **parameter** so the armed
  behaviour is provable now rather than on trust.

The distinction to preserve, and to state in a comment: contract §2.4 makes an absent plugin an
*absent namespace* — a routing gap, benign. An absent **head coach** is not benign: there is no
mediator, so there is no `decide`, no `plan`, and no way to weigh one domain against another. It is
a startup error, not a gap. This is the one exemption from §2.6's "the active set is a profile
fact"; a comment should say so, because the next reader will otherwise take it for a bug.

`head` is reserved here but **not registered** — Chunk 7 supplies the `PluginDefinition`. Until
then `coach head …` routes to the same unknown-namespace gap any unregistered key produces, and the
always-active check has nothing to admit. Make sure the reservation does not fabricate a phantom
plugin in `registeredPluginKeys()`.

## Inherited invariants that bind this task

- **Profile isolation is a hard invariant.** Nothing here touches path resolution; leave the scoper
  alone.
- **§2.5 stays cheap.** Listing keys runs no plugin code and touches no filesystem. The exemption
  must not introduce a read.
- **Missing ≠ zero.** A missing plugin-selection document is a **gap** (Chunk 13's two-phase parse);
  a missing `head` is an **error**. Do not collapse them.
- **Comments:** short, only the non-obvious *why* — the envelope's core-query purpose, and why
  `head` is exempt from the profile's selection.

## Acceptance criteria

- [ ] `HistoryEntry` requires `at`, `kind`, `by`, `summary`; `payload` is optional; the open index
      signature is gone. A `// @ts-expect-error` test proves a row with a stray top-level field no
      longer compiles.
- [ ] `history.append` → `recent()` round-trips the envelope through real JSONL on a temp
      `dataRoot`, and appending a second entry leaves the first **byte-identical**.
- [ ] `MANDATORY_NAMESPACES` is `["head"]`, and `head` is **not** in `CORE_NAMESPACES` — asserted,
      because putting it there would silently block Chunk 7.
- [ ] Against a registered set containing `head`, an active set omitting it throws
      `MISSING_MANDATORY_PLUGIN` naming the namespace; one including it succeeds.
- [ ] Against a registered set without `head`, the check is dormant — today's empty active set still
      resolves.
- [ ] `registeredPluginKeys()` does **not** list `head` (nothing is registered yet), still runs no
      plugin code, and still touches no filesystem.
- [ ] `coach head summary --profile=pedro` returns the ordinary unknown-namespace gap, not a crash
      and not a phantom plugin.
- [ ] Every existing Chunk 1–2 test remains green — this is a retro-fit, not a redesign.
- [ ] `npm test` green; `npm run lint` clean.

## Out of scope

The head-coach plugin itself, its policy port and its `validate` (**Chunk 7**). The `progress` and
`reconcile` verbs (**Chunks 5–6**). `DatedFact` and staleness horizons (**Chunk 4**). The two-phase
profile-driven parse (**Chunk 13**) — this task hard-codes nothing about *which* profile is active,
it only guarantees `head` is in whatever set is resolved. Projecting history into DuckDB (Chunk 4's
call).

## Definition of done

Report: the final `HistoryEntry`, how the `head` reservation and the always-active exemption are
each expressed (and where the error is raised), which existing tests needed touching and why,
`npm test` output, and any deviation from amendments §1.2 or §5.4 — deviating requires flagging,
not silence.
