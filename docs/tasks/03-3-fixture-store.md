# Task 3.3 — The seeded fixture DuckDB and a read-only `MetricStore`

**Chunk:** 3 — Plan schema, YAML persistence, first deterministic command
**Depends on:** Chunk 2 (done, reviewed). Independent of 3.0, 3.1 and 3.2 — can run in parallel.
**Blocks:** 3.4 (it reads this store).
**Discipline:** Not test-first, but ships tests.
**Recommended agent:** **Codex** — tier **Terra** · **Effort:** medium — a real code surface, a new
client dependency to wire, and a declared-ownership boundary to honour.

## Context

Read `AGENTS.md`, the plan's **Chunk 3** and **Chunk 4**, **design spec §5** (*files canonical,
DuckDB derived; one DB per profile, keyed by date*), and the plugin contract **§1.7** — the store is
*"the one kind whose boundary is enforced by declared ownership rather than by the path scoper"*.

**Resolve the apparent conflict before you start.** Chunk 2 says *"`MetricStore` ships as an
interface only — the DuckDB implementation is Chunk 4; Chunk 2 grows no database"*, and
`src/infra/storage/metric-store.ts` currently throws `METRIC_STORE_UNAVAILABLE` for everything. But
Chunk 3 must produce *"a seeded fixture per-profile DuckDB used by engine tests"* and a command
*"reading policy thresholds and the fixture store"*. The two are compatible on this split, which is
this task's scope:

- **Chunk 3 (here): reads.** A real `MetricStore.rows()` over a per-profile DuckDB, limited to the
  tables the plugin declared at registration.
- **Chunk 4: ingestion and writes.** `garmin-cli` → DuckDB, `coach sync`, the extractor, and
  `insert()`. `insert()` keeps throwing `METRIC_STORE_UNAVAILABLE` after this task, and its message
  keeps naming Chunk 4.

`types.ts` already anticipates this: *"Interface only here; Chunk 4 implements it and may widen this
surface."* `@duckdb/node-api` is already a pinned dependency (`1.5.5-r.1`).

## Goal

A deterministic command can read dated metrics for one profile, and can read **only** the tables its
plugin declared.

## Deliverables

- **`DuckDbMetricStore`** implementing `MetricStore` for reads:
  - `tables` reports the declared allowlist, as today.
  - `rows(table)` returns that table's rows for the bound profile. A table **not** in the declared
    allowlist throws a named `CoachError` identifying the table and the namespace — this is §1.7's
    boundary, and it is the only enforcement the store has.
  - **It does not accept arbitrary SQL from a plugin** (§1.7). `coach query` is the core-side
    escape hatch and it is not this task.
  - `insert()` still throws the Chunk 4 error.
  - Wire it into `StorageFactory.create` in place of `UnavailableMetricStore`. Keep
    `UnavailableMetricStore` only if something still needs it; otherwise delete it — a Chunk 2 stub
    outliving its purpose is how dead code starts.
- **The store's location:** `data/<profile>/store/` is already scaffolded. Resolve the database file
  through the existing binding/scoper — **do not** build the path beside it.
- **A seed path, not a committed binary.** Commit the fixture *data* (CSV or JSON under
  `test/fixtures/store/`) and build the DuckDB file into a temp directory at test setup. Two
  reasons, both worth a comment: design §5 makes files canonical and the DB derived — a committed
  `.duckdb` inverts that — and a binary in git is unreviewable. This also prefigures Chunk 4's
  extractor, which rebuilds the store from git.
- **The seeded content:** daily running metrics keyed by date, rich enough for 3.4's ACWR and
  trailing-load arithmetic — at minimum per-day distance, a session-type marker, and enough history
  to cover a **4-week rolling window plus the current week**. 3.4 owns what the numbers *mean*; this
  task owns that they exist and are stable.

## Inherited invariants that bind this task

- **Profile isolation is a hard invariant.** One DB per profile, resolved through the profile
  scoper. A test must prove profile B's store cannot be reached from profile A's handle.
- **Missing ≠ zero.** A **missing store file must not read as zero rows** — that is exactly the
  coercion this rule exists to stop, and an empty result set is indistinguishable from "no data".
  Fail by name, as `UnavailableMetricStore` already does, and let the calling command raise the gap.
- **Reads only its own.** The allowlist is the whole boundary here; there is no path scoper inside a
  single DuckDB file. Assert it.
- **Comments:** short, only the non-obvious *why* — why the allowlist is the boundary, why the
  fixture is seeded rather than committed, why a missing store is an error and not an empty read.

## Acceptance criteria

- [ ] `rows()` returns seeded rows for a declared table, keyed by date and stably ordered.
- [ ] `rows()` on an **undeclared** table throws a named error identifying the table and namespace.
- [ ] `insert()` still throws `METRIC_STORE_UNAVAILABLE` naming Chunk 4.
- [ ] A **missing** store file is a named error, not `[]`.
- [ ] Two profiles' stores are separate files, and a handle bound to one cannot read the other.
- [ ] The fixture DB is built from committed seed data into a temp directory; no `.duckdb` binary is
      committed.
- [ ] Every existing Chunk 2 storage test stays green, including the capability assertions in
      `test/infra/storage/capabilities.test.ts` — the `store` handle's method set must not change
      shape.
- [ ] `npm test` green; `npm run typecheck` clean; `npm run lint` clean.

## Out of scope

`garmin-cli` ingestion, `coach sync`, the sync-fail-loud fallback, the extractor, `insert()` and any
write path (all **Chunk 4**). `coach query` (**core, Chunk 4+**). Real Garmin data. Deciding what a
metric *means* (**3.4**). Schema migrations for the store.

## Definition of done

Report: the `DuckDbMetricStore` surface; how the allowlist is enforced and what happens on a
violation; the store file's resolved path; the seed format and the fixture's date range and shape;
whether `UnavailableMetricStore` survived and why; `npm test` output; and any deviation from
contract §1.7.
