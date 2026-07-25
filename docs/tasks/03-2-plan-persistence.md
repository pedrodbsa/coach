# Task 3.2 — `writePlan` / `readPlan`: the sole-writer path

**Chunk:** 3 — Plan schema, YAML persistence, first deterministic command
**Depends on:** 3.1 (the schema and its validator) and 2.2's codec, already built.
**Blocks:** 3.5, Chunk 4.4 (the extractor reads plan files), Chunk 7.4 (the `det` write step),
Chunk 8.1 (`garmin.push` reads the approved plan).
**Discipline:** **Test-first (TDD).** Round-trip stability *is* the deliverable; write the golden
tests before the functions.
**Recommended agent:** **Codex** — tier **Terra** · **Effort:** medium — a contained surface with
the ambiguity already resolved below.

## Context

Read `AGENTS.md`, the plan's **Chunk 3**, **design spec §6** (*"the CLI validates and persists
YAML — on-disk format chosen for the athlete and for git diffs"*), and the plugin contract **§1.8**
(*"Core commands may keep using `CoachContext.resolve` for paths no kind covers"*).

Chunk 2 built the one YAML path the engine has: `src/utils/yaml.ts` (safe core-schema parse,
`writeFileAtomic` with a same-directory temp file) and `src/utils/files.ts`
(`readYamlDocument`/`writeYamlDocument`). **Reuse them.** The plan records this codec being pulled
forward from Chunk 3 precisely so this task introduces no second serializer and no second atomic
write.

### Two things this task must decide, because no spec settles them

**1. Where the plan file lives.** Design spec §6 writes it as `data/<profile>/…/<date>.plan.yaml`
with the middle elided. Contract §1.3's tree has only `logbook/<YYYY-MM>.yaml` — profile-level,
cross-domain, not namespaced — and `LogbookDocuments` assumes **one document per month**, not one
per day.

**Recommendation:** `data/<profile>/logbook/<YYYY-MM>/<date>.plan.yaml`, resolved through
`ctx.resolve` — the core-only escape hatch contract §1.8 keeps for exactly this. It mirrors
`content-source/logbook/`'s month-folder shape, keeps the plan on the server-authoritative side of
the path-disjoint boundary, and leaves `LogbookDocuments` untouched. The plan file is **not** a
plugin capability: it spans `decision`, `markers` and every module, so no namespace owns it and no
`Storage` handle may reach it. Take the recommendation or overrule it with a recorded reason — but
do not leave it implicit.

**2. What "byte-stable" can actually mean.** The plan's verify clause says *"a golden-file test
round-trips the prototype plan YAML through `readPlan → writePlan` byte-stably"*. **As phrased that
test is impossible:** the prototype carries comments and banner blocks, and `document.toJS()`
discards them. Decompose it into the two honest tests in the acceptance criteria below.

## Goal

One path that turns a specialist's JSON into a validated plan on disk, and reads it back unchanged
— the sole-writer guarantee made mechanical.

## Deliverables

- **`writePlan(ctx, plan)`**: validate against 3.1's validator, **refuse to persist anything with a
  hard violation** (returning the violations, not throwing past the caller), serialize with
  `serializeYaml`, write with `writeFileAtomic`. A rejected plan leaves any existing file
  byte-identical.
- **`readPlan(ctx, date)`**: read, parse through the safe codec, validate, return the typed plan.
  A missing plan reads as `null` — never `{}` — and the **calling command** turns that into a
  `{ field, reason, action }` gap. The store does not manufacture the gap (contract §1.10).
- **A committed normalized fixture**, `test/fixtures/plans/<date>.plan.yaml`: the prototype's
  content as this codec emits it. This is the golden file, and it doubles as the fixture Chunks 4,
  7 and 8 read.
- Deterministic key ordering, so a re-write produces a clean git diff rather than a reordering.
  Whatever guarantees it — insertion order from the typed structure, or an explicit ordering — say
  so in a comment; the athlete reads these diffs.

## Inherited invariants that bind this task

- **The CLI is the only writer of coaching content.** This *is* that path. Nothing else in the
  engine may write a plan file.
- **Profile isolation.** The path goes through `ctx.resolve`, which is the profile scoper. Do not
  build a path beside it; do not weaken it.
- **Missing ≠ zero.** A missing plan is `null`, not an empty plan.
- **Path-disjoint write authority.** The plan is server-authoritative — under `data/<profile>/`,
  never in a logic path.
- **Comments:** short, only the non-obvious *why* — why the plan is not a plugin capability, why
  key order is pinned, why a rejected plan writes nothing.

## Acceptance criteria

- [ ] **Golden test A (structure):** the prototype YAML, with 3.1's two corrections, reads into the
      expected typed plan — asserted field by field, not by snapshot.
- [ ] **Golden test B (stability):** the committed normalized fixture survives
      `readPlan → writePlan` **byte-identically**, and a second pass is identical again.
- [ ] A plan with a **hard** violation is refused; an existing file on that path is byte-identical
      afterwards, and the violations come back in the standard
      `{ ok, violations: [{ rule, expected, actual, severity }] }` shape.
- [ ] A plan with only **warn** violations persists, and the warnings are reported.
- [ ] `readPlan` for a date with no file returns `null`; a test asserts the **command** turns that
      into a `{ field, reason, action }` gap with `ok: false` in the envelope.
- [ ] A malformed plan file surfaces the codec's typed parse error naming the path — never a
      partial plan.
- [ ] Tests run against a **temp `dataRoot`**, never the real `data/pedro/`.
- [ ] No second YAML serializer and no second atomic-write helper exist in the repo — assert by
      inspection and say so in the report.
- [ ] `npm test` green; `npm run typecheck` clean; `npm run lint` clean.

## Out of scope

The `schema_version` **mismatch** hard failure (**3.5**). The prose journal written beside the plan
(**Chunk 7.4**). The extractor projecting the plan into DuckDB (**Chunk 4.4**). Git commits — no
store or writer method commits anything; that is the workflow's job. Any real plan content.

## Definition of done

Report: the two function signatures; the plan file's resolved path and the reasoning if you
overruled the recommendation; how key ordering is guaranteed; what the normalized fixture differs
from the prototype in (and why each difference is correct); `npm test` output; and any deviation.
