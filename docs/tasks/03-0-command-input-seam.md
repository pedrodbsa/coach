# Task 3.0 — Argv declaration in the CLI binding (`--date` and positionals)

> **Rewritten 2026-07-25.** The first version of this file put Commander's flag grammar
> (`CommandOption.flag = "--date <date>"`) on `PluginCommand`, dragging a CLI library's syntax into
> the plugin seam. That version was built and reviewed; its regressions are recorded on the board.
> `2026-07-25-plugin-seam-and-observations.md` §1 moved the argv declaration into the co-located CLI
> binding, and **task 2.7** builds that seam. This file is what remains: teaching the binding to
> declare flags and positionals, and the parser to render them.

**Chunk:** 3 — Plan schema, YAML persistence, first deterministic command
**Depends on:** **2.7** (the binding seam exists and is compile-checked)
**Blocks:** 3.4 — its verify clause is `coach running trailing-load --profile=pedro --date=<fixture-date>`
**Discipline:** Not test-first, but ships tests. It re-plumbs the command tree, so Chunk 1's CLI
tests plus 2.7's error-precedence test are the regression net — run them unmodified.
**Recommended agent:** **Codex** — tier **Terra** · **Effort:** medium — wiring against a tight
spec, with the layering judgment already spent in 2.7.

## Context

Read `AGENTS.md`, the plan's **Chunk 3**, **spec §8** (the CLI's output contract), and
`docs/superpowers/specs/2026-07-25-plugin-seam-and-observations.md` **§1.2 and §1.7**.

After 2.7, a plugin's CLI binding maps a verb to a method and narrows the raw argv bag into that
method's typed input. What it cannot yet do is say **what argv it accepts**, so nothing can take a
flag.

**2.7 went further than its brief, and it changes this task.** `commandInput` is gone — with
`accepts` deferred here it had nothing to return — and `CommandSurface` is now `namespaces()` +
`verbs(namespace)`, both static. The on-demand leaf registration in `program.ts` is **deleted**: the
whole tree, core and plugin alike, is now built up front from the surface. So this task adds the
declaration to `VerbBinding` and gives the surface a way to hand it to the parser — a third static
method beside `verbs()`, or a richer return from it. Your call; report which and why.

Against the built CLI today:

```
coach stub summary --profile=pedro --date=2026-07-25  →  unknown option '--date=2026-07-25'
coach core version --profile=pedro --date=2026-07-25  →  unknown option '--date=2026-07-25'
coach stub summary breakfast --profile=pedro          →  too many arguments for 'summary'
```

Chunk 3's verify clause needs `--date`; Chunk 5 needs `--day-type=` and `--gym=`; Chunk 9 needs the
positional in `coach nutrition confirm breakfast`.

**Commander's grammar is allowed here and nowhere else** (amendment §1.2). This file is the CLI
adapter; naming flags is its job.

## Goal

A verb declares the flags and positional arguments it accepts, the parser builds them, and the
declaration stays **static data** — so the command tree is still built without a profile, a
`Storage`, or a constructed plugin.

## Deliverables

### 1. The declaration, in the CLI layer

Beside the binding types 2.7 introduced (`src/cli/…`, not `src/models/` — this is transport
knowledge):

```ts
/** One flag. `flag` is Commander's own syntax; this is the CLI adapter, so that is correct here. */
export interface CommandOption {
    readonly flag: string;          // "--date <date>", "--gym <gym>"
    readonly description: string;
}

/** One positional, named so it reaches the method by key rather than by index. */
export interface CommandArgument {
    readonly name: string;
    readonly description: string;
    readonly required: boolean;
}

export interface CommandInputSpec {
    readonly options?: readonly CommandOption[];
    readonly args?: readonly CommandArgument[];
}
```

A verb in the binding gains `readonly accepts?: CommandInputSpec`. Absent means "no flags, no
positionals" — today's behaviour, unchanged.

Export **`DATE_OPTION` once** and reuse it. `--date` appears on nearly every verb from Chunk 4
onward; three domains inventing three descriptions is the drift this repo exists to remove.

### 2. `program.ts` renders it

In the loop that already registers every verb from `surface.verbs(namespace)`:
`.option(flag, description)` per option, `.argument("<name>" | "[name]", description)` per argument.
The raw bag handed to the binding's narrowing step is **the parsed options merged with the named
positionals**, keyed by declared name — flat, because a Telegram or HTTP host must be able to build
the same bag without knowing what argv is.

Two rules:

- **The parser never invents a value.** A declared-but-absent option arrives as `undefined`; the
  *method* decides whether that is a default from `ctx.clock` or a gap. Defaulting `--date` inside
  the parser would put a coaching decision in the argv adapter and quietly break *missing ≠ zero*.
  Say so in a comment — the next reader will otherwise "helpfully" default it.
- **The declaration stays static.** Rendering must not construct a plugin or resolve a profile.
  2.7's test asserting this must still pass.

`--profile` stays a **global** option on the program. Do not move it.

### 3. Core commands too

`core version` takes no input, but Chunk 4's `coach brief build --date=…` is imminent. Give the core
command surface the same optional `accepts`, so the first core verb with real input needs no
re-plumbing. Keep it minimal.

### 4. A missing required input is a gap, not parser prose

Today Commander produces `{ field: "command", reason: "error: missing required argument 'meal'" }` —
framework prose in the machine channel, and a gap that does not name the field. Where the binding
can do better, it should: `{ field: "meal", reason: …, action: "pass the meal id, e.g. breakfast" }`.

**Decide and record which inputs are enforced by Commander and which by the binding.** The
recommendation: let Commander reject *unknown* flags (that check is worth keeping — it is a Chunk 1
verified behaviour), and let the **binding** raise gaps for *missing* declared inputs, so the athlete
gets a field-level remedy rather than a parser error. Whichever you choose, be consistent and say so.

## Inherited invariants that bind this task

- **Structured JSON on stdout, always** — exactly one envelope on every path. The Chunk 1 property
  most easily broken by re-plumbing the tree.
- **Missing ≠ zero.** A declared option that was not passed is `undefined`, never a fabricated
  default; a missing required input is a first-class gap wherever the binding can name the field.
- **Profile isolation.** Nothing here resolves a path or touches `data/`.
- **Layering.** Commander's grammar may appear in `src/cli/` and in a plugin's `cli.ts`. It may not
  appear anywhere else — assert by inspection and state it in the report.
- **Comments:** short, only the non-obvious *why* — why the parser does not default, why the bag is
  flat, why `--profile` stays global.

## Acceptance criteria

- [ ] `coach core version --profile=pedro` output is **byte-identical** to today's.
- [ ] A verb declaring `--date <date>` receives `{ date: "2026-07-25" }` from both
      `--date=2026-07-25` and `--date 2026-07-25`.
- [ ] The same verb without `--date` receives `date: undefined` — the parser neither defaults nor
      errors.
- [ ] A verb declaring a required positional receives it by name.
- [ ] A **missing** required input produces exactly one envelope, exit non-zero, and — per the
      choice recorded in deliverable 4 — a gap naming the field where the binding owns it.
- [ ] A flag the verb did **not** declare is still `unknown option`, one envelope, exit non-zero.
- [ ] Building the command tree still constructs **no plugin** and resolves **no profile** — 2.7's
      test passes unmodified.
- [ ] **2.7's error-precedence test passes unmodified**: with no profile, `coach cycling targets`
      still reports `unknown namespace`, not `no profile selected`.
- [ ] The engine-startup-failure test still passes.
- [ ] All Chunk 1 and Chunk 2 CLI tests pass **unmodified**.
- [ ] `npm test` green; `npm run typecheck` clean; `npm run lint` clean.

## Out of scope

The two-phase profile-driven parse (**Chunk 13**) — 2.7 already made the tree fully static, so that
chunk's remaining work is swapping the surface per profile, not restructuring the parser.
`--resume` (**Chunk 5**). Help text (disabled by design).
Validating a verb as a safe path segment — contract §2.3 says it should be and it is not; today a
verb is only ever an object key behind `Object.hasOwn`, so **raise it as a finding, do not fix it
here**. Any command that actually consumes `--date` (**3.4**).

## Definition of done

Report: the final `CommandInputSpec` and where it hangs off the binding; the exact object shape the
narrowing step receives; the Commander-versus-binding split chosen in deliverable 4 and why; the
verbatim envelope for a missing required input; confirmation that no Commander grammar escaped
`src/cli/` or a plugin's `cli.ts`; `npm test` output; and any deviation.
