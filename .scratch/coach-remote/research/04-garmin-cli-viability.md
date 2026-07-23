# garmin-cli — Viability as a Load-Bearing Dependency

**Research date:** 2026-07-22
**Question:** The coach-remote design spec (`docs/superpowers/specs/2026-06-19-coach-remote-interface-design.md`) routes all Garmin **reads** through a Rust tool called `garmin-cli`, citing `crates/garmin-cli/src/db/models.rs` as though it were a known dependency. Is that tool real, and can a system that must keep working for years rest on it?
**Method:** Primary sources only — the GitHub repository, its raw source files, the GitHub REST API, crates.io API, docs.rs. No claim below rests on pretrained knowledge.

---

## Verdict

`garmin-cli` is **real, correctly identified, and technically well-suited** to what the spec asks of it. The cited path `crates/garmin-cli/src/db/models.rs` exists verbatim, and every schema claim the spec makes about it is confirmed against that file. Installation, containerisation and — critically — **unattended authentication all check out**: the tool auto-refreshes its OAuth2 token from a stored OAuth1 token on every sync, with no password and no browser, so it can run on a cron in a container indefinitely. But it is a **bus-factor-1 personal project**: 47 stars, 0 watchers, 313 total downloads across all versions ever, 51 of 58 commits by one author, no stability guarantee. Its real fragility is not code quality but the thing it talks to — it reverse-engineers Garmin's **private, undocumented, unversioned** mobile SSO API, and in a five-week window (2026-03-24 → 2026-04-22) Garmin broke authentication badly enough to require **six separate fixes and two emergency releases**. The tool survived because one person patched it within days. That is the dependency: not the code, but that person's continued attention. The design can rest on it **only because the fallback is cheap** — the Garmin MCP already sits in the architecture for writes and can serve reads, so a stall degrades performance and elegance, not capability. Adopt it, but treat it as a replaceable optimisation layer, never as the only road to Garmin data.

---

## Identity

| Attribute | Value |
|---|---|
| Project | **`vicentereig/garmin-cli`** — "Garmin Connect CLI for your fave Agent" |
| Repository | https://github.com/vicentereig/garmin-cli |
| Author | **vicentereig** (Vicente Reig Rincón de Arellano) |
| Licence | **MIT** |
| Language | Rust |
| Stars / forks / watchers | **47 / 11 / 0** |
| Open issues | 2 |
| Created | 2025-12-13 |
| Last push | **2026-07-12** (repo metadata); last commit on `main` **2026-07-05** |
| Latest release | **v2.1.0**, 2026-06-01 |
| crates.io | https://crates.io/crates/garmin-cli — **313 total downloads**, all versions |
| Archived/disabled | No — active |

**The cited path is real.** `crates/garmin-cli/src/db/models.rs` exists on `main` at 7,158 bytes (verified via the GitHub git-trees API). The repo is a Cargo workspace with a single member crate under `crates/garmin-cli/`, which is exactly the layout the spec's path implies. There is no ambiguity and no competing candidate: other Rust Garmin projects surfaced in search (`poster515/Rust-Garmin`, `eddmann/garmin-connect-cli`) are libraries or differently-structured CLIs and do not match the path, the DuckDB/Parquet store, or the `db/models.rs` module. **This is the right project.**

**Release history** (crates.io API): 0.1.0 (2025-12-13), 1.0.0–1.0.6 (2025-12-18/19), 2.0.0 (2026-03-10), 2.0.1 (2026-04-01), 2.0.2 (2026-04-13), 2.1.0 (2026-06-01). Nothing yanked. Versioning is semver-shaped and the 2.x line has held since March.

---

## Findings

### 1. Identity — established

See table above. Confirmed from four independent primary sources: the GitHub repo API, the git-trees API (for the path), the crates.io API (for versions), and docs.rs (for the module contents).

### 2. Maturity and risk

**It is a personal project with a bus factor of 1.** Contributor list (GitHub contributors API):

| Contributor | Commits |
|---|---|
| vicentereig | **51** |
| peetzweg | 3 |
| TheConstructorBot | 2 |
| mrw34 | 1 |
| grunt3714-lgtm | 1 |

One author owns 88% of commits and all releases. **Zero watchers** and **313 lifetime downloads** (42 for the current release) mean essentially no user base to notice or fix a break. There is no organisation behind it, no funding, no stated support policy.

**It is actively maintained *right now*.** Commits through 2026-07-05, issues opened and closed the same week, and an external contributor's bug fix (`mrw34`, "parse calories and heart rate fields as floats") merged promptly. Responsiveness has been good.

**The dominant risk is upstream, not internal.** The issue history shows Garmin repeatedly breaking authentication:

| # | Title | Created |
|---|---|---|
| 3 | `garmin auth mfa` | 2026-03-10 |
| 4 | Cannot log in: Could not find page title | 2026-03-24 |
| 5 | Replace HTML SSO scraping with mobile JSON API | 2026-03-31 |
| 6 | Solidify SSO OAuth handoff to match garth | 2026-04-01 |
| 7 / 8 | Use API-specific headers for mobile SSO login | 2026-04-12 / 04-13 |
| 10 | Switch auth to multi-strategy SSO with DI token refresh | 2026-04-22 |

Six auth-breaking issues in five weeks, forcing releases v2.0.1 and v2.0.2. The release notes confirm the cause: v2.0.1 switched to "Garmin's mobile JSON login API" after Garmin changed their SSO, and v2.0.2 adopted "API/mobile-style headers." Garmin offers no public API, no versioning contract, and no deprecation notice. **Every one of these breaks was total** — no auth means no sync, meaning no data.

**If it goes unmaintained**, the tool keeps working until Garmin next changes SSO — historically a matter of months — and then stops completely and permanently. The MIT licence and small, readable Rust codebase mean a fork is legally and technically possible, but patching reverse-engineered SSO is genuinely hard work, and the reference implementation to copy from is the Python `garth` library the project already explicitly tracks (issue #6, "Solidify SSO OAuth handoff to match garth").

### 3. Build and runtime

**Three install routes**, per the README: Homebrew (`brew install vicentereig/tap/garmin`), Cargo (`cargo install garmin-cli`), and **prebuilt binaries** from the releases page. For a container, prebuilt binaries are the right choice — no Rust toolchain in the image.

**Release assets for v2.1.0** (GitHub releases API), confirming the spike's operational note:
`checksums.txt`, `garmin-darwin-amd64.tar.gz`, `garmin-darwin-arm64.tar.gz`, `garmin-linux-amd64.tar.gz`, `garmin-linux-arm64.tar.gz`.

Linux amd64 **and** arm64 are both published, so the image works on either architecture.

**Dependencies** (`crates/garmin-cli/Cargo.toml`): clap, reqwest + reqwest_cookie_store, tokio, serde/serde_json, keyring, dirs, tabled/comfy-table, thiserror, chrono, regex, scraper, url, base64, hmac, sha1, rand, percent-encoding, urlencoding, rpassword, **rusqlite**, **arrow + parquet**, **gpx + geo + wkt + xml-rs**, dashmap. Dev: wiremock, tempfile.

**`duckdb` is no longer a dependency.** It was removed on 2026-06-21 (merged 06-28), and issue #16 identifies the scope precisely: *"Remove DuckDB dependency in collecting devices"* — it was only used by the `devices` command, never in the storage path. **This does not affect the store.** The tool writes Parquet via the `arrow`/`parquet` crates; DuckDB is purely an *external* query engine reading those files. If anything this **reduces** build risk by dropping a heavy native dependency. The spec's "DuckDB/Parquet store" phrasing remains accurate in effect, though strictly the tool produces Parquet and DuckDB is your reader.

**Container viability — one concrete trap, already found.** Linux release binaries are built for `x86_64-unknown-linux-gnu` / `aarch64-unknown-linux-gnu` (not musl) on the `ubuntu-latest` runner, so they are **dynamically linked against glibc**. This confirms the spike's finding that `debian:bookworm-slim` (glibc 2.36) fails with `GLIBC_2.38 not found` and `debian:trixie-slim` is required.

> **Risk the spike did not flag:** the release workflow pins the runner to **`ubuntu-latest`, unpinned**. When GitHub advances that image, the glibc floor of the published binary rises silently, with no changelog entry. A future `garmin-cli` release can break your container base image without any code change on either side. Pin the base image deliberately, verify on each upgrade, and prefer `cargo install` (or a musl build) if you want that variable removed.

Coexistence with Node, Python/`uv` and DuckDB in one Linux image is otherwise unproblematic — it is a single static-ish binary plus a data directory, no daemon, no port, no runtime conflict. The spec already acknowledges the multi-runtime image as an accepted cost.

### 4. Auth — the spec's mechanism is wrong; the conclusion is right

**Refuted: it is not browser-SSO.** The spec says "`garmin-cli` uses browser-SSO (`garmin auth login`)". The README's phrasing "Login (opens browser for SSO)" is stale marketing text — the actual implementation in `crates/garmin-cli/src/cli/commands/auth.rs` **prompts on the terminal**: `print!("Email: ")` + `io::stdin().read_line(...)` for the address, `rpassword::read_password()` for the password, then POSTs to Garmin's SSO. MFA is supported by a further terminal prompt (`print!("MFA Code: ")`).

**This is better news than the spec assumed.** A terminal prompt is trivially satisfiable in a container (`docker exec -it … garmin auth login`); a real browser flow would have been a genuine headless-server problem. The spec reached the right operational conclusion by the wrong route.

**Confirmed: it survives unattended.** This was the decisive question, and the answer is yes. The login flow (`client/sso.rs`) walks `GET /mobile/sso/en/sign-in` → `POST /mobile/api/login` → optional `POST /mobile/api/mfa/verifyCode` → `GET /oauth-service/oauth/preauthorized` → `POST /oauth-service/oauth/exchange/user/2.0`, yielding an OAuth1 token and an OAuth2 token. Crucially, `sso.rs` exposes **`refresh_oauth2()`**, which calls the exchange endpoint with `login: false` — **no password required**.

That refresh is wired into the sync path. `cli/commands/sync.rs` opens with `let (_, oauth2) = refresh_token(&store).await?;`, and `refresh_token` is:

```rust
pub async fn refresh_token(store: &CredentialStore) -> Result<(OAuth1Token, OAuth2Token)> {
    let (oauth1, oauth2) = store.load_tokens()?.ok_or(GarminError::NotAuthenticated)?;

    if !oauth2.is_expired() {
        return Ok((oauth1, oauth2));
    }

    println!("Refreshing access token...");
    let sso_client = SsoClient::new()?;
    let new_oauth2 = sso_client.refresh_oauth2(&oauth1).await?;

    store.save_oauth2(&new_oauth2)?;

    Ok((oauth1, new_oauth2))
}
```

**Every sync self-heals its access token.** OAuth2 access tokens live 1 hour and their refresh tokens 24 hours (`expires_in: 3600`, `refresh_token_expires_in: 86400`), but that is irrelevant to uptime because the **long-lived OAuth1 token** mints a fresh OAuth2 on demand. Interactive re-login is needed only when the OAuth1 token itself dies — the same model as `garth`, which the project deliberately mirrors, where OAuth1 tokens last on the order of a year. *(The exact OAuth1 lifetime is set by Garmin and is not stated in the source — unverifiable from public sources, but empirically ~1 year in garth-based tooling.)*

**Token storage suits a container.** `config/credentials.rs` writes plain JSON — `oauth1_token.json` and `oauth2_token.json` — under `{data_dir}/{profile}/`, chmod `0o600`. The `keyring` dependency is **optional**: keyring access lives in separate `store_secret_in_keyring()` / `load_secret_from_keyring()` methods, and core save/load is filesystem-only. **A headless container with no D-Bus secret service works fine.** This confirms the spike's observation of tokens on the volume under `default/`.

Practical consequence: mount the token directory as a persistent volume, log in interactively **once**, and the cron sync runs unattended until Garmin invalidates the OAuth1 token or changes SSO again.

### 5. Sync coverage and schema — confirmed from source

`garmin sync run` supports `--from/--to`, `--backfill`, `--activities`, `--health`, `--performance`, `--dry-run`, plus `sync status|reset|clear` for the task queue. Architecture is 4 producers (rate-limited API fetch) → bounded channel → 4 consumers (Parquet write with partition locks), with a SQLite task queue for crash recovery.

**Store layout** (README): `~/.local/share/garmin/` on Linux — `activities/` (weekly partitions), `track_points/` (daily), `daily_health/` (monthly), `performance_metrics/` (monthly), `profiles.parquet`. Matches the spike exactly. There is **no monolithic DuckDB file**; you query Parquet globs, e.g. `SELECT … FROM '$GARMIN_DATA/daily_health/*.parquet'`.

**Schema, verbatim from `crates/garmin-cli/src/db/models.rs`.** Every field the spec claims is present:

- **`DailyHealth`** — `steps`, `step_goal`, `total_calories`, `active_calories`, `bmr_calories`, `resting_hr`, `sleep_seconds`, `deep_sleep_seconds`, `light_sleep_seconds`, `rem_sleep_seconds`, `sleep_score`, `sleep_note`, `avg_stress`, `max_stress`, `body_battery_start`, `body_battery_end`, `hrv_weekly_avg`, `hrv_last_night`, `hrv_status`, `avg_respiration`, `avg_spo2`, `lowest_spo2`, `hydration_ml`, `moderate_intensity_min`, `vigorous_intensity_min`, `raw_json`.
  → Sleep stages + score ✓, HRV ✓, resting HR ✓, stress ✓, body battery ✓, respiration ✓, SpO2 ✓. **All confirmed.** Bonus: `vigorous_intensity_min` directly serves the "vigorous minutes drive fitness age" concern in project memory.

- **`PerformanceMetrics`** — `vo2max`, `fitness_age`, `training_readiness`, `training_status`, `lactate_threshold_hr`, `lactate_threshold_pace`, `race_5k_sec`, `race_10k_sec`, `race_half_sec`, `race_marathon_sec`, `endurance_score`, `hill_score`, `raw_json`.
  → Training readiness ✓, training status ✓, lactate threshold ✓ (both HR *and* pace), endurance score ✓. **All confirmed**, plus VO2max and race predictions. Note: project memory records the VO2max *MCP endpoint* as unreliable and uses the 10K race prediction as a proxy — **both `vo2max` and `race_10k_sec` are columns here**, so that workaround becomes a local SQL read.

- **`Activity`** — `activity_id`, `profile_id`, `activity_name`, `activity_type`, `start_time_local`, `start_time_gmt`, `duration_sec`, `distance_m`, `calories`, `avg_hr`, `max_hr`, `avg_speed`, `max_speed`, `elevation_gain`, `elevation_loss`, `avg_cadence`, `avg_power`, `normalized_power`, `training_effect`, `training_load`, `start_lat`, `start_lon`, `end_lat`, `end_lon`, `ground_contact_time`, `vertical_oscillation`, `stride_length`, `location_name`, `raw_json`.
  → avg/max HR ✓, distance ✓, duration ✓, cadence ✓, power ✓, training effect ✓, training load ✓, running dynamics ✓ (GCT, vertical oscillation, stride length). **Minor correction: there is no `pace` column** — pace is derived from `avg_speed` or `distance_m`/`duration_sec`. The spec lists "pace" as though it were stored.
  → `raw_json` on all three tables is a useful escape hatch: fields the typed schema omits may still be recoverable without touching the API.

- **`TrackPoint`** — `id`, `activity_id`, `timestamp`, `lat`, `lon`, `elevation`, `heart_rate`, `cadence`, `power`, `speed`. **Exactly** the column list and naming (`lat`/`lon`, not `latitude`/`longitude`) the spike reported.

- **`WeightEntry`** — `weight_kg`, `bmi`, `body_fat_pct`, `muscle_mass_kg`. Supports the spec's `/body` read path for Withings-via-Garmin weigh-ins. *(Note: it carries `date` but no intra-day timestamp field, which bears on the "check weigh-in timestamps" lesson in project memory — fasted-morning vs post-run classification may need `raw_json` or the MCP.)*

- Also present: `Profile`, `SyncState`, `SyncTask`, and enums `SyncPipeline`, `SyncTaskType`, `TaskStatus` (sync bookkeeping only).

**No struct represents splits, laps, or HR zones.** Confirmed against both the raw source and the docs.rs module index.

### 6. The specific claims — see table below

---

## Claims check

| # | Spec claim | Status | Evidence |
|---|---|---|---|
| 6a | `track_points` populated for outdoor GPS activities, **zero rows** for indoor/treadmill | **Confirmed** | `sync/mod.rs` gates GPX download on `activity.get("hasPolyline").and_then(\|v\| v.as_bool()).unwrap_or(false)` — *"Queue GPX download for activities with GPS"*. No polyline → no GPX task queued → no rows. Mechanism now identified, not just observed. |
| 6b | `speed` and `power` columns exist but are **never populated** | **Refuted as stated** — see below | Columns exist ✓, but the parser *does* assign them. `parse_gpx()` builds `TrackPoint { … power: stream.power, speed: point.speed.or(stream.speed) }`, matching XML elements `"speed"` and `"power" \| "powerinwatts" \| "watts"` case-insensitively. README: track_points holds *"GPX sensor streams (HR, cadence, power, speed **when present**)"*. |
| 6c | **No** splits/laps table and **no** time-in-HR-zone field | **Confirmed** | `db/models.rs` defines only Profile, Activity, TrackPoint, DailyHealth, PerformanceMetrics, WeightEntry, SyncState, SyncTask. No lap/split/zone struct. Corroborated by the docs.rs module index. |
| 6d | ~54 KB Parquet per outdoor run, ~10 MB/year | **Unverifiable from public sources** | No published storage benchmarks. The spike's own measurement (272 KB / 13,713 points ≈ 20 bytes/point compressed) is the only evidence and is plausible for columnar Parquet over 10 mostly-numeric columns. Treat as a local measurement, not a vendor guarantee. |

### On 6b — the correction that matters

The spike concluded *"garmin-cli's GPX parser does not emit them."* **That explanation is wrong.** The parser was upgraded on 2026-05-03 (commit `21b29f2`, "Parse GPX sensor streams into track points", which added the `xml-rs` dependency) to populate both fields; before that they were hardcoded `None`. That commit shipped in **v2.1.0** — the very version the spike tested.

So the spike's *observation* (null on every point) is almost certainly correct, but the **cause is data-side, not tool-side**: Garmin's exported GPX for those runs contained no speed or power elements. Garmin's `TrackPointExtension` carries `hr` and `cad` — which is exactly why heart rate and cadence populated and the other two did not. Note also that the parser reads **standalone** XML elements by name rather than unwrapping Garmin's `TrackPointExtension` namespace wrapper, which may itself limit what it captures.

**Practical impact on the design: none — the decisions still hold.**
- `speed` will stay null for this athlete's runs (GPX 1.1 has no per-point speed element), so **haversine over `lat`/`lon` remains the right way to build `v_activity_splits`**, outdoor-only.
- `power` would populate for a device exporting running/cycling power as `PowerInWatts` — so it is *conditionally* available, not structurally absent.

**Why the distinction is worth recording:** "never populated" invites a future reader to delete the columns or stop testing them. The accurate statement is *"unpopulated for this athlete's current device and activity mix"* — which is a data fact that can change with a device upgrade, not a permanent property of the tool. Update the spec's wording accordingly.

---

## Risk assessment

**What breaks if the tool stalls.** In descending severity:

1. **Garmin changes SSO and nobody patches it.** Total loss: no auth → no sync → the store freezes at its last-good date. Precedent is strong (six auth issues in five weeks, March–April 2026) and the fix has always come from one person. **This is the single most likely failure mode.** Note it degrades *gracefully in one respect*: the existing Parquet store stays readable and all historical aggregate queries keep working. Only freshness is lost — and freshness is exactly what `/plan` needs each morning.
2. **The unpinned `ubuntu-latest` release runner raises the glibc floor**, breaking the container on a routine `garmin-cli` upgrade. Low severity, easy to fix, easy to be surprised by. Mitigate by pinning the Debian base and testing before upgrading.
3. **Silent schema drift.** A field renamed in `models.rs` changes Parquet column names, and SQL written against the old name fails — or worse, an added-then-removed column returns nulls. Nothing guarantees Parquet schema stability across versions. Pin the `garmin-cli` version in the image; upgrade deliberately.
4. **Sync reliability.** Issue **#18, "Retry of syncs seems to be broken," is open** (created 2026-06-28) alongside #17 on sync progress. Since the design has *every* command force a sync before reading, a hanging or silently-failing sync is a live operational concern. **The morning job must treat sync failure as a visible error and fall back, not proceed on stale data.**

**What the fallback costs.** This is what makes the risk acceptable. `Taxuspt/garmin_mcp` is **already in the architecture** for writes, is already authenticated (its own `garth` OAuth cache), and — per the tool roster available in this environment — exposes read coverage that is *broader* than the local store, including things garmin-cli has no table for at all: `get_activity_splits`, `get_activity_typed_splits`, `get_activity_hr_in_timezones`, `get_training_load_balance`, `get_hrv_data`, `get_body_battery`, `get_training_readiness`, `get_race_predictions`.

So a garmin-cli stall costs, concretely:
- **Not capability — cost and latency.** Aggregate/longitudinal queries (ACWR, trailing 7/28-day load, HRV-vs-volume trend) revert from one SQL statement to N tool calls plus in-model arithmetic. That is precisely the token-cost and correctness problem the split was designed to avoid, and it lands hardest on the model's ability to do multi-week trend reasoning reliably.
- **Loss of offline resilience.** The store answers when Garmin's API is flaky; the MCP does not.
- **No loss of the write path.** Workout creation/scheduling never depended on garmin-cli.
- **Retained history.** The Parquet store is committed to git daily, so accumulated history survives the tool's death and stays queryable by DuckDB forever — **DuckDB reads Parquet with no help from garmin-cli**. This is a genuinely strong property: the *data* has no dependency on the tool, only the *ingestion* does.

**Recommendation.** Adopt it, with three guardrails:
1. **Pin the version** of the binary and the Debian base image; upgrade deliberately and re-verify the schema.
2. **Keep the MCP read path alive and exercised** — the spike already established it is *required* for indoor/treadmill per-sample analysis, so it cannot be allowed to bit-rot. That mandatory role conveniently doubles as the stall insurance.
3. **Make sync failure loud.** Since every command force-syncs first, a failed sync must surface as an error and trigger the MCP fallback, never a silent read of stale data. Given open issue #18, do not assume retries work.

The architecture's own risk register already names "two third-party Garmin deps — `garmin-cli` and the MCP can each break or drift." That framing is right, and the mitigation is the redundancy that already exists.

---

## Sources

- https://github.com/vicentereig/garmin-cli — repository, README
- https://api.github.com/repos/vicentereig/garmin-cli — metadata (stars, forks, dates, issues)
- https://api.github.com/repos/vicentereig/garmin-cli/contributors — bus factor
- https://api.github.com/repos/vicentereig/garmin-cli/commits — commit history
- https://api.github.com/repos/vicentereig/garmin-cli/issues?state=all — auth/sync issue history
- https://api.github.com/repos/vicentereig/garmin-cli/releases/latest — v2.1.0 assets
- https://api.github.com/repos/vicentereig/garmin-cli/git/trees/main?recursive=1 — confirms `crates/garmin-cli/src/db/models.rs`
- https://api.github.com/search/commits?q=repo:vicentereig/garmin-cli+duckdb — DuckDB removal
- https://api.github.com/search/commits?q=repo:vicentereig/garmin-cli+GPX — GPX parser commits
- https://github.com/vicentereig/garmin-cli/commit/21b29f2bc1c031e4216e2ab60d15f2b5d5ef5cf6.patch — speed/power population
- https://raw.githubusercontent.com/vicentereig/garmin-cli/main/crates/garmin-cli/src/db/models.rs — full schema
- https://raw.githubusercontent.com/vicentereig/garmin-cli/main/crates/garmin-cli/src/sync/mod.rs — `parse_gpx`, `hasPolyline` gate
- https://raw.githubusercontent.com/vicentereig/garmin-cli/main/crates/garmin-cli/src/client/sso.rs — SSO + `refresh_oauth2`
- https://raw.githubusercontent.com/vicentereig/garmin-cli/main/crates/garmin-cli/src/cli/commands/auth.rs — `refresh_token`, terminal login
- https://raw.githubusercontent.com/vicentereig/garmin-cli/main/crates/garmin-cli/src/cli/commands/sync.rs — sync auth wiring
- https://raw.githubusercontent.com/vicentereig/garmin-cli/main/crates/garmin-cli/src/config/credentials.rs — token files, optional keyring
- https://raw.githubusercontent.com/vicentereig/garmin-cli/main/crates/garmin-cli/src/client/tokens.rs — token expiry model
- https://raw.githubusercontent.com/vicentereig/garmin-cli/main/crates/garmin-cli/Cargo.toml — dependencies
- https://raw.githubusercontent.com/vicentereig/garmin-cli/main/.github/workflows/release.yml — build targets, glibc linkage
- https://crates.io/api/v1/crates/garmin-cli — versions, downloads, licence
- https://docs.rs/garmin-cli/latest/garmin_cli/db/models/index.html — module index (no splits/laps/zone types)
- Repo-local: `docs/superpowers/specs/2026-06-19-trackpoint-spike-findings.md`, `docs/superpowers/specs/2026-06-19-coach-remote-interface-design.md`
