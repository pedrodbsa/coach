# Task 2.2 — YAML codec, atomic write, and the shipped-`policy/` resolver

**Chunk:** 2 — Plugin contract sub-spec + storage service + registration
**Depends on:** Chunk 1 (done)
**Blocks:** 2.3 (the stores are built on this); reused by Chunk 3.2 (`writePlan`/`readPlan`)
**Discipline:** **Test-first (TDD).** Round-trip and atomicity are the properties; write those
tests before the implementation.
**Recommended agent:** **Codex** — tier **Terra** · **Effort:** medium — a real code surface with
a tight spec and almost no design ambiguity left to resolve.

## Context

Read `AGENTS.md`, the plan's **Chunk 2**, and `docs/superpowers/specs/2026-07-23-plugin-contract.md`
**§1.3 and §1.8**. Chunk 1 built the profile scoper, now in `src/infra/storage/scope.ts`, which guards the
`data/<profile>/` tree and already exports `POLICY_ROOT` for the shipped-defaults tree — but has
no resolver for it. This task fills that in and supplies the serialisation the stores need.

**Scope note:** the YAML codec is pulled forward from Chunk 3 deliberately (recorded in the plan)
so 2.3's stores can be round-trip tested against their real on-disk format. Chunk 3.2 **reuses**
this codec; it must not introduce a second serializer or a second atomic-write path.

## Goal

One YAML read/write path for the whole engine — safe to parse, atomic to write — plus containment
for the builder-authored `policy/` tree.

## Deliverables

- **A YAML codec** in `src/utils/yaml.ts`: parse a string to a value, and
  serialize a value to YAML.
  - Add the `yaml` package as a dependency.
  - Parsing uses the **safe/core schema only** — no custom tags, no arbitrary type construction
    from document content. Untrusted-looking input must fail, not instantiate.
  - A parse failure throws a typed, named error carrying the file path and the parser's message;
    it must never return a partial value.
  - Round-trip stability: `parse(serialize(v))` deep-equals `v` for the value shapes the engine
    uses (nested maps, arrays, strings, numbers, booleans, `null`, ISO date strings).
- **An atomic write helper**: write to a temp file **in the same directory** as the target, then
  `rename` over it. A crash mid-write must leave either the old content or the new, never a
  truncated file. Creates parent directories as needed.
- **A shipped-`policy/` resolver**: `resolveInPolicy(namespace, ...segments)` returning a path
  under `POLICY_ROOT`, with the same **single safe segment** validation the profile scoper uses
  (reuse the rule in `src/models/profile.ts` — do not re-implement it).
  - This tree is **read-only at runtime**. Expose no write path for it. Rationale: path-disjoint
    write authority — the server writes only `data/<profile>/`, the builder only logic paths.
  - It does **not** need the profile scoper's symlink layer (no per-user tree, no untrusted
    profile name), but it **does** need traversal rejection. Say so in a comment.

## Inherited invariants that bind this task

- **Path-disjoint write authority.** `policy/` is builder-authoritative; nothing here may write
  to it. `data/<profile>/` stays behind the existing profile scoper.
- **Profile isolation.** Do not weaken, wrap, or bypass `createProfileScoper`; this task adds a
  sibling for a different tree.
- **The CLI is the only writer of coaching content** — this codec is how it writes.
- **Comments:** short, only the non-obvious *why* (why same-directory temp files; why no symlink
  layer here). Match the existing files' density.

## Acceptance criteria

- [ ] Round-trip test: representative nested structures survive `parse(serialize(v))` unchanged.
- [ ] A malformed YAML document throws the typed error, naming the path; no partial value returns.
- [ ] A YAML document using a non-core tag / type-construction syntax **fails** rather than
      constructing anything.
- [ ] Atomic-write test: the temp file is created in the target's directory (not the OS temp dir),
      and an interrupted write leaves the original intact.
- [ ] `resolveInPolicy('nutrition', 'tiers.yaml')` returns a path under `POLICY_ROOT`;
      `resolveInPolicy('../data', 'x')` and a crafted namespace **throw**.
- [ ] No write function exists for the `policy/` tree.
- [ ] `npm test` green; `npm run lint` clean.

## Out of scope

The stores themselves (2.3), defaults ⊕ overrides merging (2.3), the plan schema (Chunk 3),
DuckDB, git commits.

## Definition of done

Report: the codec's exported surface, the atomic-write strategy, the policy resolver's signature,
the YAML package chosen and why it is safe by default, `npm test` output, and any deviation.
