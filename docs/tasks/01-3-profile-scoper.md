# Task 1.3 — Profile-scoping path helper (throws on escape)

**Chunk:** 1 — Repo skeleton, toolchain, CLI entrypoint & output contract
**Depends on:** 1.1 (skeleton + test harness must exist)
**Blocks:** 1.4 (nice-to-have) and every later data task (they resolve paths through this)
**Discipline:** **Test-first (TDD).** This is the hard-invariant enforcement point — write the
adversarial tests first (escape attempts), then implement until they throw.
**Recommended agent:** **Claude** — model **Opus 4.8** · **Effort:** high — security-critical
adversarial reasoning (traversal, symlink escape, crafted `profile`). The one code-enforced data
boundary; worth Opus + a high thinking budget even though the code is small.

## Context

Read `AGENTS.md`, the plan's **Chunk 1** and **Global Constraints**, and **spec §4 and §10**.
Profile isolation is *the one code-enforced data boundary* in the system. This helper is where
it is enforced; every core operation will resolve its paths through it.

## Goal

A profile-scoping helper that resolves a path **only** inside `data/<profile>/` and **throws**
on any path that escapes that root — the single chokepoint for the isolation invariant.

## Deliverables

- A function (e.g. `resolveInProfile(profile: string, ...segments): string`) that:
  - resolves the given relative segments against `data/<profile>/`,
  - **normalizes** the result and returns the absolute (or repo-relative) normalized path for a
    legal path,
  - **throws** a clear, typed error for any path that escapes `data/<profile>/` — including
    `..` traversal (`data/pedro/../partner/x`), absolute paths pointing elsewhere, and symlink-
    style escapes to the extent resolvable.
- Validation of the `profile` argument itself (reject empty, `.`/`..`, path separators, so a
  crafted `profile` can't break out).
- The error should be distinguishable (a named error class or a code) so callers can surface it
  as a hard failure / gap later.

## Inherited invariants that bind this task

- **Profile isolation is a hard invariant.** Every core operation scopes strictly to
  `data/<profile>/` and **must never cross**. Cross-profile bleed is the boundary this helper
  exists to prevent — err toward throwing when uncertain.
- **Path-disjoint write authority.** This helper governs the `data/<profile>/` tree only; it is
  not for shared-logic paths. Keep its remit to per-profile data.

## Acceptance criteria

- [ ] A test asserts `resolveInProfile('pedro', '../partner/x')` (and equivalent traversals)
      **throws**.
- [ ] A test asserts a legal path (`resolveInProfile('pedro', 'store', 'metrics.db')`) returns a
      normalized path rooted at `data/pedro/`.
- [ ] A test asserts a crafted `profile` (`'..'`, `'a/b'`, `''`) **throws** rather than
      resolving.
- [ ] A test asserts an absolute path argument pointing outside the profile root **throws**.
- [ ] `npm test` green; `npm run lint` clean.

## Out of scope

Reading/writing actual files, the envelope (1.2), DuckDB, plugins, any command wiring beyond the
helper itself.

## Definition of done

Report: the helper's signature and error type, the adversarial cases covered, `npm test`
output, and any deviation.
