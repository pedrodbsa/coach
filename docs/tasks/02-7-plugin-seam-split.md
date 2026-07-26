# Task 2.7 — The plugin seam splits: engine side, CLI binding, core-wrapped envelope

**Chunk:** 2 — addendum (retro-fit of `2026-07-25-plugin-seam-and-observations.md`)
**Depends on:** 2.3–2.6, all built and reviewed.
**Blocks:** the rewritten 3.0, and therefore 3.4; **Chunk 7.3** depends on §1.5 to pass typed values
between workflow steps instead of unwrapping an envelope at every hop.
**Discipline:** **Test-first (TDD).** The compile-time guarantees *are* the deliverable — write the
`@ts-expect-error` assertions before the refactor.
**Recommended agent:** **Claude** — model **Opus 4.8** · **Effort:** high — type design across the
load-bearing seam, plus a refactor touching eight files. The generics that make the binding
compile-checked are the hard part and they are what the task exists for.

## Context

Read `AGENTS.md`, and — as this task's specification —
`docs/superpowers/specs/2026-07-25-plugin-seam-and-observations.md` **§1 and §3.2**. Read plugin
contract **§2.1–§2.3, §3.2** for what is being superseded, and **§1.9** for the bar that must survive.

The contract describes a plugin as a bag of *commands* returning *envelopes* — a CLI-shaped
description of something that is not a CLI. Task 3.0 made that concrete and wrong: it put Commander's
own flag grammar on `PluginCommand`, which contradicts `program.ts`'s promise that *"swap Commander
for another parser and the engine is untouched"*, and forced the CLI to construct a plugin — and so
resolve a profile — during argument parsing.

**Do this now, not later.** Chunk 2 shipped one throwaway plugin. After Chunks 5–7 build three
coached ones, the same change is three times the work.

## Goal

A plugin is domain logic exposing **typed functions that return domain results**. How those
functions are reached from a command line is a **separate, co-located** concern. The core — not the
plugin — turns a domain result into an envelope.

## Deliverables

### 1. The engine side

A plugin's methods take typed input and return domain results. No `Envelope`, no argv, no `unknown`
where a type is known. `summary` stays mandatory (contract §2.3) — as a required **method**, so
omitting it is still a compile error.

Introduce `DomainSummary`, which Chunk 2 deferred and the mandatory method now needs
(amendment §3.2):

```ts
export interface DomainSummary {
    readonly namespace: string;
    /** Bounded, prose-free. Values are JSON scalars or small fixed-shape records. */
    readonly facts: Readonly<Record<string, JsonFact>>;
    /** Agent-readable context. Never parsed, never computed with, never a fact's only home. */
    readonly observations: readonly string[];
    readonly gaps: readonly Gap[];
}
```

`observations` is **required and may be empty** — optional would let a domain forget it exists.
Populating it is Chunks 5–6 and 9; this task only fixes the shape.

> A type cannot enforce "no fact is a bare string", because policy-defined enums *are* strings.
> That is why amendment §3.7 makes it a **build-time check over emitted facts**, owned by Chunk 4.
> Do not attempt it in the type system here.

### 2. The CLI binding, co-located and compile-checked

```
src/plugins/stub/
  index.ts    the definition — key, storeTables, create(storage)   ← engine side
  cli.ts      the verb table — which method each verb calls        ← integration side
```

Two hard requirements:

- **A binding that names a method the plugin does not have is a compile error** (amendment §1.4).
  Two files describing one thing will desync the first time somebody renames a method, and a
  convention will not catch it. Something in the shape of
  `method: MethodOf<P>` over a mapped type; the exact generics are yours to land.
- **Adding a plugin still edits exactly one core file** — `PLUGIN_REGISTRY` (contract §1.9). Whether
  the binding hangs off `PluginDefinition` or is a sibling export the registry collects is your call;
  report which and why. Note the mild tension either way: `plugins/types.ts` referencing a
  CLI-layer type is a leaf-type dependency, not a behavioural one.

The binding **owns the narrowing** from the raw argv bag to the method's typed input. That is the
whole point: `execute(input: unknown)` exists today only because argv has no compile-time shape, and
moving the narrowing here lets the domain function declare what it needs honestly.

### 3. The core wraps the envelope

Supersedes contract §2.2 in favour of §3.2, which already said the core lifts gaps.

- A domain function returns a **domain result**. `engine.invoke` wraps it:
  `makeEnvelope(result, [...(result.gaps ?? [])])`.
- **Gaps are copied, not moved.** The in-process consumer — Chunk 4's brief — needs each domain's
  own gaps to attribute them by namespace, and the envelope needs them at the top level.
- A small `DomainResult { readonly gaps?: readonly Gap[] }` (or equivalent) is enough to express
  "this result can degrade"; results that cannot simply omit it.

### 4. `synergies` moves engine-side

Off the per-command position, onto the engine-side definition (amendment §2). It is domain metadata,
not argv metadata. **It has no consumer anywhere in the codebase** — keep it minimal and record in
the report that Chunk 7.3 must either use it or delete it.

### 5. Undo task 3.0's profile hoist

Bindings are **static data**, so the command tree is built without constructing a plugin, without a
`Storage`, and without resolving a profile. That removes rather than patches the three findings the
Chunk 3 review recorded:

- `CommandSurface.commandInput(namespace, verb)` — **drop the `profile` parameter**; read the binding
  statically.
- In `cli/coach.ts`, remove the hoisted `resolveProfile` and delete the hand-rolled `profileFlag()`.
  `parsed.profileFlag` becomes the single source of the active profile again.
- **Keep** 3.0's engine-startup fix — constructing the engine inside `invoke`'s `try` via the
  `buildEngine` seam is correct and stays.
- Restore `program.ts`'s header sentence that it *"builds no context, constructs no plugin"*.

### 6. `accepts` is **not** in this task

The binding declares *which method a verb calls* and narrows the raw bag. Declaring **flags and
positionals**, rendering them through Commander, and the `DATE_OPTION` constant are the rewritten
**3.0**. Leave the raw bag as whatever Commander already produces; narrowing an empty bag is trivial,
and the seam is what is being proven here.

## Inherited invariants that bind this task

- **Structured JSON on stdout, always** — exactly one envelope on every path. Moving the wrapping
  from the plugin to the core is the highest-risk edit in this task for that property. Chunk 1's CLI
  tests are the regression net.
- **Profile isolation.** Nothing here touches path resolution or the scoper. The storage-capability
  assertions in `test/infra/storage/capabilities.test.ts` must not change shape.
- **§2.5 stays cheap.** Listing keys runs no plugin code and touches no filesystem — and after this
  task, neither does building the command tree.
- **Missing ≠ zero.** A domain result that degrades carries gaps; the core lifts them and `ok`
  follows. No plugin fabricates an envelope.
- **The stub is throwaway.** Rewrite it as a two-file fixture; do not let it accumulate behaviour a
  real plugin would need.
- **Comments:** short, only the non-obvious *why* — why the binding is compile-checked, why gaps are
  copied rather than moved, why the envelope is not the plugin's business.

## Acceptance criteria

- [ ] **Compile-checked binding:** a `// @ts-expect-error` test proves a binding naming a
      non-existent method fails to compile.
- [ ] **Mandatory `summary`:** a `// @ts-expect-error` test proves a plugin without it fails to
      compile.
- [ ] No type reachable from a plugin mentions `Envelope`, Commander, or argv — assert by inspection
      and state it in the report.
- [ ] `engine.invoke` wraps a domain result into `{ ok, data, gaps, schema_version }`, lifting the
      result's gaps to the envelope while leaving them on `data`.
- [ ] A domain result carrying a gap yields `ok: false` with that gap at envelope level.
- [ ] `coach core version --profile=pedro` and `coach stub summary --profile=pedro` are
      **byte-identical** to today's output.
- [ ] `commandInput` takes no profile, and a test asserts building the command tree constructs **no
      plugin** and resolves **no profile**.
- [ ] **Error-precedence regression test** (this is what let 3.0's regression through): with no
      profile set, `coach cycling targets` reports `unknown namespace "cycling"` naming the
      registered namespaces — *not* `no profile selected`. Assert the `reason`, not just the field.
- [ ] `coach` with no args, and `coach core version --bogus` with no profile, likewise report their
      own cause rather than a profile error.
- [ ] 3.0's engine-startup-failure test still passes unchanged.
- [ ] `DomainSummary` requires `observations`; a summary omitting it fails to compile.
- [ ] Every existing Chunk 1–2 test passes, adjusted only where a type genuinely moved — list each
      adjustment and why in the report.
- [ ] `npm test` green; `npm run typecheck` clean; `npm run lint` clean.

## Out of scope

Flag/positional declaration and argv rendering (**rewritten 3.0**). Populating `observations`
(**Chunks 5–6, 9**). The no-bare-string build check and staleness horizons (**Chunk 4**). Any real
plugin. `progress` / `reconcile` verbs (**Chunks 5–6**). Deleting `synergies` (**Chunk 7.3** decides).
Splitting core commands beyond what keeps `core version` working — Chunk 4's `brief build --date` is
the first core command with real input.

## Definition of done

Report: the final engine-side and binding types **verbatim**; how the compile-check on method names
is expressed; where the binding hangs and why; how the envelope wrap and gap-lift work; which
existing tests needed touching and why; confirmation that tree-building constructs no plugin;
`npm test` output; and any deviation from amendment §1 or §3.2 — deviating requires flagging, not
silence.
