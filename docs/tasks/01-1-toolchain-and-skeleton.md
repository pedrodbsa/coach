# Task 1.1 — TypeScript toolchain + two-tree layout + `coach` bin

**Chunk:** 1 — Repo skeleton, toolchain, CLI entrypoint & output contract
**Depends on:** nothing (first coding task in the repo)
**Blocks:** 1.2, 1.3, 1.4 (they build on this skeleton)
**Discipline:** Not test-first — this is scaffolding. Leave a *runnable, green* test harness with
one trivial passing test so 1.2/1.3 can add tests immediately.
**Recommended agent:** **Codex** — model **Terra** (mid workhorse) · **Effort:** medium —
mechanical config with many small correct-detail gates (bin wiring, strict tsconfig, test
runner). Pure-code/config, so Codex; well-specified and low-judgment, so Terra, not Sol.

## Context

Read `AGENTS.md` first, then the plan's **Chunk 1** section and **Global Constraints**
(`docs/superpowers/plans/2026-07-23-remote-coach-v1.md`). This is a **greenfield** repo — no
code exists yet. You are creating the project skeleton the whole engine grows from.

Do **not** treat the layout described in `AGENTS.md`/`CLAUDE.md` as pre-built. You are creating
it now. Two trees:
- **shared logic** (the CLI, plugin implementations, workflow definitions, plugin default
  policy) — versioned, the builder's write authority.
- **`data/<profile>/`** — server-authoritative per-profile data (policy overrides, profile,
  state, history, logbook, store). Create `data/pedro/` with those subfolders as empty
  placeholders (a `.gitkeep` in each).

## Goal

A TypeScript/Node project that builds, lints, and tests, with the `coach` binary wired as the
package bin, and the two-tree directory layout laid down.

## Deliverables

- `package.json` — name, type module, scripts (`build`, `test`, `lint`), and a **`bin`** entry
  mapping `coach` to the CLI entrypoint. Add the **DuckDB client** dependency (it is needed from
  Chunk 3; declaring it now is fine — do not use it yet).
- `tsconfig.json` — strict TypeScript.
- A test runner wired to `npm test` (pick one and note the choice; Vitest or Node's built-in
  `node:test` are both fine). One trivial passing test proving the harness runs.
- Lint wired to `npm run lint`.
- `src/` for shared logic with a minimal `coach` CLI entrypoint that runs (it can just print the
  envelope for `core version` in 1.4 — for now, an entrypoint that parses `coach <domain>
  <verb>` argv and exits cleanly is enough; **do not** implement commands here).
- The **two-tree layout**: shared-logic dirs under `src/` (e.g. `src/cli`, `src/plugins`,
  `src/workflows`, `policy/` for shipped default policy), and `data/pedro/{policy,profile,state,history,logbook,store}/`
  with `.gitkeep`s.
- Ensure `.gitignore` already covers the secrets/DuckDB working files (it exists — verify, don't
  weaken it).

## Inherited invariants that bind this task

- **Path-disjoint write authority** — lay the two trees down cleanly so later tasks can enforce
  it. Shared logic vs `data/<profile>/` must be visibly separate at the top level.
- Output is **structured JSON on stdout, always** — the CLI entrypoint must never print
  human prose to stdout; keep stdout reserved for the envelope (1.2/1.4 fill it in).

## Acceptance criteria

- [ ] `npm install` succeeds; `npm run build` compiles with strict TS and no errors.
- [ ] `npm test` runs the harness and is green (the one trivial test passes).
- [ ] `npm run lint` runs clean.
- [ ] The `coach` bin is invocable (e.g. `node dist/...` or via the bin) and parses
      `coach <domain> <verb>` argv without crashing (unknown commands may exit non-zero, but
      cleanly — no stack trace to stdout).
- [ ] `data/pedro/{policy,profile,state,history,logbook,store}/` exist and are tracked.
- [ ] No secret, `.env`, `.mcp.json`, Garmin token, or DuckDB working file is added to git.

## Out of scope

Any real command, the envelope type (1.2), the profile-scoper (1.3), DuckDB reads, plugins,
agents, YAML persistence.

## Definition of done

Report: the files created, the test-runner and DuckDB-client choices made, `npm test` output,
and any deviation from this spec.
