# Task 2.3 — The storage service (kind-typed stores, defaults ⊕ overrides)

**Chunk:** 2 — Plugin contract sub-spec + storage service + registration
**Depends on:** 2.2 (codec + atomic write + policy resolver); 2.1 in flight is fine — §1 of the
contract is already decided and is this task's specification.
**Blocks:** 2.5, and every plugin from Chunk 5 onward.
**Discipline:** **Test-first (TDD).** The enforcement this task exists for is *type-level* — write
the `expectTypeOf` assertions and the containment tests **before** the implementation.
**Recommended agent:** **Claude** — model **Opus 4.8** · **Effort:** high — this is the isolation
boundary in a new form, and the capability split is what makes "no policy edits from Telegram"
mechanical rather than a convention. Invariant-critical.

## Context

Read `AGENTS.md`, the plan's **Chunk 2** and **Global Constraints**, **spec §5** (four kinds and
*why* the split exists), **§13** (path-disjoint authority), and — as the specification for this
task — **`docs/superpowers/specs/2026-07-23-plugin-contract.md` §1**, which is decided. §1.5 gives
the interfaces almost verbatim; §1.2 records the rejected alternative, so do not re-derive it.

Chunk 1 built the profile scoper and `CoachContext.resolve`. Per §1.8 the scoper remains the
single containment chokepoint and lives privately inside `src/infra/storage/`.

## Goal

A plugin never sees a filesystem path. It is handed one handle per kind whose available methods
match that kind's write rule, so an action that must not edit policy has **no method to do it**.

## Deliverables

- `src/infra/storage/` implementing §1.5: `PolicyReader`, `DocumentReader`, `DocumentStore`,
  `AppendOnlyLog`, `LogbookReader`, and the `PluginStorage` facade binding one `(profile,
  namespace)` pair.
- **A profile-bound `StorageFactory` on `CoachContext`** — `storage.create(namespace, tables)`
  returns the capability set for one plugin.
- **Effective policy** in `PolicyReader.read`: shipped `policy/<ns>/<doc>.yaml` ⊕
  `data/<profile>/policy/<ns>/<doc>.yaml`.
  - **Merge semantics — decide and document:** objects merge recursively; **arrays and scalars
    replace wholesale**. Rationale to record in a comment: an override list (the athlete's HR
    zones, their gym's equipment) is a *replacement*, not an addition — appending would silently
    keep a default the athlete meant to remove.
  - `layers()` returns both sides unmerged, so `decide` can answer "why is this value what it is".
- **`GovernedStorage`** (§1.5): the same handle with `PolicyWriter` / `DocumentWriter` attached.
  Define the type and its constructor; **wire it to nothing** — the `decide` workflow is Chunk 13.
  A comment must say that obtaining it is the governed path's privilege.
- **`MetricStore` as an interface only.** No DuckDB in this chunk. A `PluginStorage` exposes the
  property; the implementation throws a clear "not implemented until Chunk 4" error.
- **`CoreStorage`** (§1.6): `forPlugin(ns)` and `activePolicy()` for the head coach's union read.
  Core-only — not reachable from a `PluginStorage`.
- Directory layout exactly per §1.3, including `profile/core/` for profile facts owned by no
  single plugin.

## Inherited invariants that bind this task

- **Profile isolation is a hard invariant.** Every path still goes through `createProfileScoper`.
  Do not construct paths beside it, and do not relax it.
- **Reads only its own.** A `PluginStorage` binds one namespace and must offer no way to name
  another. Cross-domain need is a **petition** through the head coach, not a read.
- **Missing ≠ zero.** A missing document reads as `null` — never `{}`, never a coerced default.
  The store does **not** manufacture the `Gap`; only the calling command knows the field name and
  the remedy.
- **The CLI is the only writer of coaching content.** Writes go through 2.2's atomic path.
- **Path-disjoint write authority.** No code path here writes to the shipped `policy/` tree.
- **Comments:** short, only the non-obvious *why* — the merge semantics, why `GovernedStorage`
  exists unwired, why the scoper is private now.

## Acceptance criteria

- [ ] **Type-level:** `expectTypeOf<PluginStorage['policy']>` has no `write`; assigning a
      `PolicyWriter` to it fails to compile. Same for `profile`. (A `// @ts-expect-error` test
      counts.)
- [ ] **Type-level:** `AppendOnlyLog` exposes no overwrite or delete.
- [ ] `policy.read` returns the default when no override exists; the merge when both exist; and
      `null` when neither does.
- [ ] A merge test proves objects merge recursively **and** an override array replaces the default
      array rather than concatenating.
- [ ] `layers()` reports both sides separately, including when one is absent.
- [ ] `storage('stub')` resolves under `data/<profile>/{policy,profile,state,history}/stub/`; a
      crafted namespace or document id **throws `PROFILE_SCOPE_VIOLATION`**.
- [ ] No handle can produce a path outside its own namespace — assert for each kind, not just one.
- [ ] `state.write` then `state.read` round-trips through real YAML on a temp `dataRoot`.
- [ ] `history.append` twice leaves the first entry byte-identical; `recent()` returns both.
- [ ] `MetricStore` methods throw the explicit "Chunk 4" error rather than failing obscurely.
- [ ] Existing Chunk 1 behavior remains green — `CoachContext.resolve` is additive.
- [ ] `npm test` green; `npm run lint` clean.

## Out of scope

DuckDB (Chunk 4), the plan schema (Chunk 3), the `decide` workflow (Chunk 13), any real plugin's
policy content, git commits (the workflow's job — no store method commits anything), retention /
history eviction (a core job, later).

## Definition of done

Report: the exported interfaces and how each kind's capability is expressed in the type system,
the merge semantics chosen, how `ctx.resolve` and the scoper's role changed (and what still uses
them), `npm test` output, and any deviation from contract §1 — deviating requires flagging, not
silence.
