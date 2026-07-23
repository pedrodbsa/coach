# content-source — raw material to port

This folder is a **verbatim copy** of the current `routine` repo's coaching content, carried over
as the source for the port in Chunk 1. It is **not** the live tree and nothing reads it at
runtime.

- `protocols/` — the 11 protocol documents (coaching, running, training, nutrition,
  meal-rotation, strength-exercises, mobility, skin-log, supplements, current-status,
  daily-template).
- `logbook/` — seven months of daily files (`YYYY-MM/YYYY-MM-DD.md`) plus monthly reports.

## What Chunk 1+ does with it

The port is a **restructure into the four data kinds** (spec §5), not a copy:

- **Policy** (defaults) → shared logic; **overrides** → `data/pedro/`.
- **Profile** (HR zones, race calendar, goals, equipment) → `data/pedro/`.
- **State** (working loads, metrics snapshot, weight) → the per-profile store.
- **History** (the coaching log) → appended/evicted history.

Specific splits called out by the spec:

- `current-status.md` splits four ways.
- `strength-exercises.md` splits **by column** — movement library → policy; loads + dates →
  store state.
- `running.md` — policy half → shared defaults; profile half (HR zones/calibration) → `data/pedro/`.
- `training.md` **dissolves** — its readiness and Cumulative-Load rules move to the head coach.
- `logbook/` prose → `data/pedro/logbook/`; its machine-readable fields are the extractor's
  input to rebuild the DuckDB store.

## When to delete

Once the content is ported and the extractor round-trips (Chunk 4), delete this folder — the
canonical content then lives under shared `policy/` and `data/pedro/`.
