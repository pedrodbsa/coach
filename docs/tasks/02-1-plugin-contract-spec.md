# Task 2.1 — Finish the plugin contract sub-spec

**Chunk:** 2 — Plugin contract sub-spec + storage service + registration
**Depends on:** Chunk 1 (done)
**Blocks:** 2.3, 2.4, 2.5 — they implement what this document decides
**Discipline:** Written spec, no code.
**Recommended agent:** **Claude** — model **Opus 4.8** · **Effort:** high — this is the document
the plan flags as "load-bearing enough to deserve its own specification". Pure design judgment.

## Context

Read `AGENTS.md`, the plan's **Chunk 2** and **Global Constraints**, and **spec §4** (plugins,
the profile, head-coach mediation), **§5** (four kinds), **§8** (validators, summary), **§13**
(repo topology). Then read `docs/superpowers/specs/2026-07-23-plugin-contract.md` — **§1 (storage
and data ownership) is already drafted and decided.** Do not relitigate it; the remaining sections
must be consistent with it.

## Goal

Complete the contract so a future plugin — cycling, household, social life — slots in without
touching the core, and so **non-quantitative domains are not precluded**.

## Deliverables

Sections §2–§6 of `docs/superpowers/specs/2026-07-23-plugin-contract.md`, matching §1's voice
(decision → rationale → rejected alternative where one exists):

- **§2 Registration and the CLI namespace.** What a plugin declares (namespace, commands, its
  `summary` provider, `depends_on`, its declared store tables per §1.7). `coach <domain> <verb>`;
  **an absent plugin is an absent namespace** — not a namespace that errors at call time.
- **§3 The deterministic `summary`.** Every plugin exposes one; it is deterministic (no SDK, no
  agent), it is what the head coach reads *instead of* raw domain data, and the brief is the
  concatenation of active plugins' summaries. Say what shape it returns and that it must degrade
  to gaps rather than fabricate.
- **§4 When a plugin warrants a coach.** The bar from the plan: it has a *how* to decide daily
  **or** domain policy to evolve. A plugin may be **policy-only** (mobility in v1) — the contract
  must make a coach optional, not assumed.
- **§5 `depends_on`.** What it declares, and that the workflow runner topologically sorts step
  order from it rather than from a hand-written sequence (Chunk 7.3).
- **§6 Petitions.** Cross-domain influence is mediated by the head coach and phrased as a
  **capability or priority**, never domain internals ("the athlete needs posterior-chain strength
  work", not "do RDLs at 80 kg"). Pair this with §1.6: a plugin *cannot* read another's data, so
  petitioning is the only channel — state that explicitly.

Also update the file's status header (it currently says "Draft — §1 only").

## Inherited invariants that bind this task

- **Profile isolation** — nothing in the contract may give a plugin a way to address another
  profile. §1 already closes this; keep it closed.
- **The CLI is the only writer of coaching content.** A plugin's coach emits JSON; the CLI
  validates and persists. The contract must not describe a plugin writing files directly.
- **Missing ≠ zero.** `summary` returns gaps for what it cannot compute.
- Where this document and `2026-07-23-remote-coach-v1-design.md` disagree, **the parent spec
  wins** — flag the disagreement rather than silently deviating.

## Acceptance criteria

- [ ] §2–§6 written; the status header no longer says "§1 only".
- [ ] Every section is consistent with the already-decided §1 (no contradicting storage claims).
- [ ] The document states the *bar* explicitly and tests itself against it: a worked paragraph
      showing how a **household** plugin (non-quantitative, no coach, no `store` use) satisfies
      the contract.
- [ ] Each section cites its parent-spec § or decision number, as §1 does.
- [ ] No code, no test changes.

## Out of scope

Implementing the registry (2.4), the storage service (2.3), any real plugin, the `summary`
*content* for any domain.

## Definition of done

Report: the section list as written, any place the contract had to choose where the parent spec
was silent, and any disagreement found with the parent spec.
