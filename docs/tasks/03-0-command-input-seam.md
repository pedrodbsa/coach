# Task 3.0 — The command input seam (`--date` and friends) + one envelope on every path

**Chunk:** 3 — Plan schema, YAML persistence, first deterministic command
**Depends on:** Chunk 2 (done, reviewed)
**Blocks:** 3.4 (its verify clause is `--date=<fixture-date>`), 3.5, and every verb from Chunk 5
onward that takes a flag or an argument
**Discipline:** Not test-first, but ships tests. It re-plumbs the command tree, so Chunk 1's CLI
tests are the regression net — run them unmodified.
**Recommended agent:** **Codex** — tier **Terra** · **Effort:** medium — wiring against a tight
spec; this file spends the design judgment so the worker does not have to.

## Context

Read `AGENTS.md`, the plan's **Chunk 3** and **Global Constraints**, **spec §8** (the CLI's output
contract), and `docs/superpowers/specs/2026-07-23-plugin-contract.md` **§2.2–§2.3**.

Chunk 2's review found that **no command can accept a flag or a positional argument.**
`src/cli/program.ts` registers every leaf as `.command(verb).action(…)` with no `.option()` calls,
and neither `PluginDefinition` nor `PluginCommand` carries a declaration. Against the built CLI:

```
coach stub summary --profile=pedro --date=2026-07-25  →  unknown option '--date=2026-07-25'
coach core version --profile=pedro --date=2026-07-25  →  unknown option '--date=2026-07-25'
coach stub summary breakfast --profile=pedro          →  too many arguments for 'summary'
```

Chunk 3's own verify clause is `coach running trailing-load --profile=pedro --date=<fixture-date>`,
and contract §3.2 types `summary` as `(input: { date: IsoDate })`. So this is a **prerequisite of
Chunk 3's stated scope, not an addition to it** — and it is equally owed to Chunk 5's
`nutrition tier --day-type=…` / `strength slice --gym=…` and Chunk 9's `nutrition confirm breakfast`.

The second half of this task closes a latent hole in the same file. `runCli` takes its engine as a
**default parameter**, evaluated outside the body's error handling:

```ts
export async function runCli(argv, stdout, stderr, env, engine = new CoachEngine({ … })) {
```

A constructor throw therefore never reaches `invoke`'s `try`. Reproduced: a raw stack trace on
stderr and **no envelope on stdout**, violating *structured JSON on stdout, always*. Unreachable
today (the default active set always validates), but it arms the moment engine construction can
fail on the real path — Chunk 7 registering `head`, Chunk 13 reading `profile/core/plugins.yaml`.
Fix it now while it costs two lines.

## Goal

A command — core or plugin — **declares** the flags and positional arguments it accepts; the parser
builds them and hands the command a plain object. The parser never invents a value, and the host
still emits exactly one envelope on every path, including its own startup failure.

## Deliverables

### 1. The declaration

In `src/models/command.ts` (it is the type both `CoreCommand` and `PluginCommand` already lean on):

```ts
/** One flag a command accepts. `flag` is Commander's own syntax, so nothing is re-parsed here. */
export interface CommandOption {
    /** e.g. `"--date <date>"` or `"--gym <gym>"`. Boolean flags carry no placeholder. */
    readonly flag: string;
    readonly description: string;
}

/** One positional argument, named so it reaches the command by key rather than by index. */
export interface CommandArgument {
    readonly name: string;
    readonly description: string;
    readonly required: boolean;
}

/** What a command accepts. Absent means "no flags, no arguments" — today's behaviour. */
export interface CommandInputSpec {
    readonly options?: readonly CommandOption[];
    readonly args?: readonly CommandArgument[];
}
```

`--date` will appear on nearly every verb from Chunk 4 onward. Export it **once** as a shared
constant (`DATE_OPTION`) beside the types and reuse it; three domains inventing three descriptions
is exactly the drift this repo exists to remove.

### 2. Both command surfaces carry it

- `PluginCommand` gains `readonly accepts?: CommandInputSpec` beside `synergies`. Named `accepts`
  rather than `input` so it does not read as the value `execute` receives.
- The core surface gains the same. `CORE_COMMANDS` currently maps a verb straight to a function;
  widen the value to `{ accepts?, run }` (or an equivalent) so `core version` can stay
  declaration-free while a later core verb — `brief build --date=…` — is expressible.

### 3. `program.ts` applies it

The leaf-building code calls `.option(flag, description)` per option and `.argument()` per argument.
Two rules:

- **The parser never invents a value.** A declared-but-absent option arrives as `undefined`; the
  command decides whether that is a default from `ctx.clock` or a `{ field, reason, action }` gap.
  Defaulting a date inside the parser would put a coaching decision in the argv adapter and would
  quietly break *missing ≠ zero*.
- **`execute` receives one flat object**: the parsed options merged with the named positionals,
  keyed by declared name. Flat because a plugin narrows `unknown` anyway (see the rationale already
  in `plugins/types.ts`), and because a Telegram or HTTP host must be able to build the same bag
  without knowing what argv is. A positional's declared `name` is the key; an option's key is
  Commander's camel-cased long name.

`--profile` stays a **global** option on the program. Do not move it.

### 4. The host emits an envelope on its own startup failure

Keep `runCli`'s existing optional `engine` parameter (tests pass one), but construct the default
**inside** `invoke`'s `try` when none is supplied, so a `CoachError` thrown by the `CoachEngine`
constructor folds into the same single-gap envelope as everything else. No call site changes.

## Inherited invariants that bind this task

- **Structured JSON on stdout, always** — exactly one envelope on every path, success or failure.
  This is the Chunk 1 property most easily broken by re-plumbing the command tree, and the reason
  deliverable 4 is in this task rather than a later one.
- **The CLI is the one interface.** This adds no new surface: it lets existing commands say what
  they already need to say.
- **Missing ≠ zero.** A declared option that was not passed is `undefined`, never a fabricated
  default. Say so in a comment — the next reader will otherwise "helpfully" default `--date`.
- **Profile isolation.** Nothing here resolves a path or touches `data/`.
- **Comments:** short, only the non-obvious *why* — why the parser does not default, why the bag is
  flat, why `--profile` stays global.

## Acceptance criteria

- [ ] `coach core version --profile=pedro` output is **byte-identical** to today's.
- [ ] A verb declaring `--date <date>` receives `{ date: "2026-07-25" }` from both
      `--date=2026-07-25` and `--date 2026-07-25`.
- [ ] The same verb invoked **without** `--date` receives `date: undefined` — the parser neither
      defaults nor errors.
- [ ] A verb declaring a required positional receives it by name; omitting it is a parse failure
      that still prints exactly one envelope, exit non-zero, no Commander prose on stdout.
- [ ] A flag the verb did **not** declare is still `unknown option`, one envelope, exit non-zero.
- [ ] A test drives `runCli` with an engine builder that throws and asserts stdout carries exactly
      one well-formed envelope with `ok: false` and a `command` gap — no stack trace, no silence.
- [ ] All Chunk 1 and Chunk 2 CLI tests pass **unmodified**.
- [ ] `npm test` green; `npm run typecheck` clean; `npm run lint` clean.

## Out of scope

The two-phase profile-driven parse (**Chunk 13**) — the on-demand leaf registration in `program.ts`
stays as it is, with its existing comment. `--resume` (**Chunk 5**). Help text and `--help`
(disabled by design). Validating a verb as a safe path segment (contract §2.3 says it should be;
today a verb is only ever an object key behind `Object.hasOwn` — raise it as a finding, do not fix
it here). Any actual `--date`-consuming command (3.4).

## Definition of done

Report: the final `CommandInputSpec` and where it hangs off each surface, the exact object shape
`execute` now receives, how the startup-failure path was closed, the verbatim envelope for a missing
required positional, `npm test` output, and any deviation.
