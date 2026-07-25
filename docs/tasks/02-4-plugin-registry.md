# Task 2.4 — Plugin registry and `coach <domain> <verb>` dispatch

**Chunk:** 2 — Plugin contract sub-spec + storage service + registration
**Depends on:** 2.1 (§2 of the contract fixes what a plugin declares). Independent of 2.2/2.3 —
can run in parallel with them.
**Blocks:** 2.5, and every plugin from Chunk 5 onward.
**Discipline:** Not test-first, but ships tests.
**Recommended agent:** **Codex** — tier **Terra** · **Effort:** medium — wiring against a tight
spec; the judgment was spent in 2.1.

## Context

Read `AGENTS.md`, the plan's **Chunk 2**, **spec §8** (`coach <domain> <verb>`, an absent plugin
is an absent namespace; Commander's own plugin model is **not** used), and
`docs/superpowers/specs/2026-07-23-plugin-contract.md` §2.

Chunk 1 built `src/cli/program.ts`, where the command tree is currently hardcoded
(`core.command("version")`). That hardcoding is what this task replaces. Note the existing design
decision in that file: Commander **parses and routes only** — it returns a `ParsedRequest`; the
execution layer builds the context and emits the envelope. Preserve that separation; the registry
must not gain a way to write stdout or build a context.

## Goal

The command tree is **derived from the registry**, so adding a plugin adds a namespace and
removing one removes it — with no core edit either way.

## Deliverables

- `src/plugins/registry.ts`: a `PluginDefinition` (namespace, commands, `summary` provider,
  `depends_on`, declared store tables per contract §1.7) and `createRegistry(plugins)`.
  - Duplicate namespaces are a **startup error**, not last-registration-wins.
  - A namespace is validated as a single safe segment (reuse `models/profile.ts`'s rule).
- `program.ts` builds its Commander tree from the registry instead of hardcoding. `core` stays a
  built-in namespace; `core version` keeps working byte-identically.
- Registry accessors: list active plugins, look one up, and expose each plugin's declared
  `depends_on` (the Chunk 7.3 workflow runner topologically sorts from it).
- An **unregistered namespace** produces the standard envelope with a `command` gap whose reason
  names the namespace and whose action lists the registered ones. Exit non-zero, one envelope,
  no Commander prose on stdout — identical handling to Chunk 1's unknown-command path.

## Inherited invariants that bind this task

- **Structured JSON on stdout, always** — exactly one envelope, including on every error path.
  This is the Chunk 1 property most easily broken by re-plumbing the command tree; re-run Chunk
  1's CLI tests.
- **The CLI is the one interface.** The registry is internal wiring; it exposes no new surface.
- **Profile isolation.** Dispatch passes the profile-scoped context through unchanged; the
  registry never resolves a path or touches `data/`.
- **Comments:** short, only the non-obvious *why*.

## Acceptance criteria

- [ ] A test asserts the registry lists **only** active plugins and exposes each one's declared
      `depends_on`.
- [ ] A duplicate namespace throws at registry construction, naming the collision.
- [ ] With a plugin registered, `coach <ns> <verb> --profile=pedro` routes to it.
- [ ] With it absent, `coach <ns> <verb>` errors with an "unknown namespace" gap naming the
      registered namespaces — exit non-zero, exactly one envelope, no Commander prose on stdout.
- [ ] `coach core version --profile=pedro` output is unchanged from Chunk 1.
- [ ] All Chunk 1 CLI tests still pass unmodified.
- [ ] `npm test` green; `npm run lint` clean.

## Out of scope

The stub plugin itself (2.5), the storage service (2.3), any real plugin, `summary` content,
`coach run <domain>` / the Agent SDK, the workflow runner.

## Definition of done

Report: the `PluginDefinition` shape, how `program.ts` now derives its tree, the unknown-namespace
envelope verbatim, `npm test` output, and any deviation.
