# 04 — `garmin-cli` viability

Type: research
Status: resolved

> Full findings with citations: `../research/04-garmin-cli-viability.md`

## Question

The spec cites `crates/garmin-cli/src/db/models.rs` and describes its DuckDB/Parquet schema in
detail, as though the tool were a known and available dependency. Establish what it actually
is:

- Where the repository lives, and what its licence and maintenance status are.
- Whether it builds and runs on the target platform (the server, inside the app container).
- What auth it uses, and how that auth is kept alive unattended (the spec says browser SSO
  via `garmin auth login`, with the token persisted on the server).
- What `garmin sync` actually covers, and whether the schema matches the spec's claims —
  particularly the `DailyHealth`, `PerformanceMetrics`, `Activity` and `track_points` tables.
- Whether the trackpoint findings recorded in
  `docs/superpowers/specs/2026-06-19-trackpoint-spike-findings.md` still hold.

## Why this matters

The read half of the whole design rests on this tool. If it is unavailable, unmaintained, or
does not build in the container, the fallback is the Garmin MCP for reads as well as writes,
which removes most of the argument for the local store.

## Context

- Memory records that the spec's `garmin-cli` is a **different** Rust/DuckDB tool from the
  abandoned local `.venv` Python exporter under `scripts/` in this repo. Confirm or correct
  that.

## Answer

Resolved 2026-07-22 by background research. Detail and citations in
`../research/04-garmin-cli-viability.md`.

**Adopt it — but as a replaceable optimisation layer, not a dependency.** The tool is real and
fits technically; the risk is organisational.

### Identity — confirmed

[`vicentereig/garmin-cli`](https://github.com/vicentereig/garmin-cli). MIT, Rust, 47 stars,
v2.1.0 released 2026-06-01, last commit 2026-07-05. The path the spec cites,
`crates/garmin-cli/src/db/models.rs`, **exists verbatim**. The spec was not inventing a
dependency, and it is confirmed distinct from the abandoned Python exporter under `scripts/`.

### Auth — the spec is wrong, and reality is better

This was the decisive question, and both halves came back favourably.

- **Refuted: it is not browser SSO.** `auth.rs` prompts for email and password on the
  **terminal** via `rpassword`, with a terminal MFA prompt. The README's "opens browser" text
  is stale. That is *easier* to satisfy in a container, not harder.
- **Confirmed: it survives unattended.** `sync.rs` calls `refresh_token()` first, minting a
  fresh OAuth2 from the stored OAuth1 via `refresh_oauth2(…, login: false)` — no password
  needed. Tokens are plain JSON files at mode 0600 and the `keyring` dependency is
  **optional**, so a headless container with no D-Bus works. Log in once; cron runs
  indefinitely.

### One spec claim refuted

**`speed` and `power` are not "never populated".** Commit `21b29f2` (2026-05-03, shipped in the
v2.1.0 the spike tested) populates both. The spike's *observation* — nulls on every run — was
correct; its *explanation* was not. The cause is data-side: Garmin's GPX export carries heart
rate and cadence but not speed for this athlete's device.

The haversine decision for outdoor splits **still stands**, but the reason must be reworded:
*"unpopulated for this athlete's device"*, not a permanent property of the tool. Anyone reading
the current wording would wrongly conclude the parser is incapable.

`docs/superpowers/specs/2026-06-19-trackpoint-spike-findings.md` carries the wrong explanation
and is owed a correction in the final spec rewrite.

### Everything else confirmed

`DailyHealth`, `PerformanceMetrics`, `Activity` and `TrackPoint` schemas match the spec's
claims. Zero indoor track points is real and gated on `hasPolyline`. No splits, laps or
HR-zone struct exists. Minor addition: there is **no `pace` column** — derive it from
`avg_speed`. Storage figures are unverifiable from public sources; the spike's own measurement
remains the only evidence.

### Two risks the spike missed

1. **Bus factor of one.** 51 of 58 commits by a single author, zero watchers, 313 lifetime
   downloads. Garmin broke authentication **six times in five weeks** (March–April 2026),
   forcing two emergency releases. One person's attention is the dependency.
2. **The release workflow pins `ubuntu-latest`, unpinned.** The glibc floor of the published
   binary can rise silently on a routine runner upgrade and break a Debian base image with no
   changelog entry. Pin both sides.

Also: open issue **#18, "Retry of syncs seems to be broken"**. Since every command force-syncs
before reading, **sync failure has to be loud** and trigger the MCP fallback rather than
degrading quietly.

### Why the risk is acceptable

The Parquet store is committed to git and DuckDB reads it directly, with no help from
`garmin-cli`. So the **data** has no dependency on the tool — only **ingestion** does. The MCP
fallback is already in the architecture for writes and is already *required* for indoor
per-sample analysis, so it stays exercised rather than rotting. A stall costs token-heavy
N-call aggregation and offline resilience; it does not cost capability.

### Consequences

- Requirement for [08 — coach CLI/SDK surface](08-coach-cli-surface.md): a failed sync must
  surface as a loud gap and switch that read to the MCP, never proceed on stale data silently.
- Requirement for [07 — Remote and secrets prerequisites](07-remote-and-secrets.md): pin the
  `garmin-cli` version and the container base image together, and add the Garmin login to the
  first-boot checklist (terminal login, not browser).
- Corrections owed in the final spec rewrite: the auth description, the `speed`/`power`
  explanation, and the missing `pace` column.
