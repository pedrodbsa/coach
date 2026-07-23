# STRENGTH EXERCISES — MASTER

> Personal strength database: one row per exercise — where it can be trained, current working load, how to program it, and the verified Garmin Connect enum.
> **Single source of truth for strength baselines** (migrated out of `current-status.md` on 2026-06-17). Nothing else holds working loads.

## Gyms & Equipment

Three locations. The **Gym** column on each exercise says where it can be trained.

### G1 — default (self-directed)

- Barbell · dumbbells · **kettlebells (16 kg, 20 kg only)**
- Squat rack · benches: flat, incline
- **Dual adjustable pulley** — 60 kg/arm, vertical + horizontal, rope + handles. **Crossover yes; cable row no.**
- Row-erg (cardio)
- **No dip station, no pull-up bar** → no full dips, no pull-ups here.

### G2 — self-directed

- Barbell · dumbbells (**no kettlebells**)
- Squat rack · benches: flat, incline, decline
- Pec-deck + chest-press machine
- **Single-pulley system:** low pulley (cable rows) + high pulley (lat pulldown), many bar adapters. **No crossover** (single pulley).
- Dip station · pull-up bar

### PT — coach-led

- Full facility incl. leg machines (leg press, leg extension, leg/ham curl, back extension). **The coach picks the work; the DB only stores the loads you log** — it does not drive selection here.

## How this file is used

- **`/report`** owns the numbers: each week it updates **Working load × reps** and **Last logged**, and upgrades a Garmin-enum status from `⚠ guess` to `✓ <date>` (or records a new trap) when `/garmin` confirms one.
- **`/plan`** reads the **Gym** column (filter to the day's gym — default **G1**), the **Working load** (progression), and **Pattern / rotation** (rotate the selection vs the last same-type session) when programming strength.
- **`/garmin`** reads the **Garmin enum** column before building a strength workout — use the `✓` enum, heed the `⚠ not …` traps, and treat `free-entry` as "closest category + name in the step description." After read-back it upgrades the status here.
- **History note:** full set-by-set history lives in the daily `logbook/` files — this table holds only the _current_ working top set plus a one-line trend.

## Legend

- **Gym:** `G1` / `G2` / `PT`; `G1·G2` = either self-directed gym.
- **`✓ MM-DD`** — `exerciseName` survived a `get_workout_by_id` read-back on that date (year 2026).
- **`⚠ guess`** — best candidate enum, not yet confirmed; `/garmin` must verify on the next upload and date it.
- **`⚠ not X`** — known silent-drop trap: Garmin keeps the category but discards `X`; use the listed name instead.
- **`free-entry`** — no surviving `exerciseName`; upload with the category shown and put the real name in the step `description`.

## Exercises

| Exercise                        | Pattern / rotation        | Gym   | Rep role              | Working load × reps                | Last logged | Garmin enum (category / exerciseName · status)                        | Notes                                                     |
| ------------------------------- | ------------------------- | ----- | --------------------- | ---------------------------------- | ----------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| Barbell bench press (flat)      | Horizontal press          | G1·G2 | Upper 8–12            | 50 kg × 12, 12, 12                 | 2026-07-20  | `BENCH_PRESS` / `BARBELL_BENCH_PRESS` ✓ 06-26                         | **Jul 20: 50×12 across** (Jul 13 50×10×4, May 20 50×8,8) — now **over** the top of the 8–12 range on every set. **Add load: → 55 kg.** The hold-and-add-reps phase is done |
| Flat DB press                   | Horizontal press          | G1·G2 | Upper 8–12            | —                                  | —           | `BENCH_PRESS` / `DUMBBELL_BENCH_PRESS` ⚠ guess                        | rotation off barbell                                      |
| Incline DB press                | Horizontal press          | G1·G2 | Upper 8–12            | 22 kg/DB × 10, 8, 7, 5             | 2026-07-01  | `BENCH_PRESS` / `INCLINE_DUMBBELL_BENCH_PRESS` ✓ 06-16                | 22 kg is the working ceiling — reps fade 10→5, consolidate before adding |
| Decline barbell press           | Horizontal press          | G2    | Upper 8–12            | —                                  | —           | `BENCH_PRESS` / `BARBELL_DECLINE_BENCH_PRESS` ⚠ guess                 | G2 decline bench                                          |
| Chest-press machine             | Horizontal press          | G2    | Upper 8–12            | —                                  | —           | `BENCH_PRESS` / free-entry                                            | G2 machine                                                |
| Standing cable chest press      | Horizontal press          | G1·G2 | Upper 10–12           | —                                  | —           | `BENCH_PRESS` / free-entry                                            | G1 dual or G2 single-arm; constant tension                |
| Overhead press (barbell)        | Vertical press            | G1·G2 | Upper 8–12            | 30 kg × 10, 10, 8                  | 2026-07-13  | `SHOULDER_PRESS` / `OVERHEAD_BARBELL_PRESS` ✓ 06-26                   | Jul 13 reps up (30×10,10,8 vs 30×8,8,8 Jun 8) — push to 10 across before loading |
| Seated DB shoulder press        | Vertical press            | G1·G2 | Upper 8–12            | 20 kg/DB × 12 (14×12, 16×12 build) | 2026-07-20  | `SHOULDER_PRESS` / `SEATED_DUMBBELL_SHOULDER_PRESS` ✓ 06-16           | **Jul 20 supersedes the Jul 1 read** — 20 kg now carries 12 reps as a ramped top set (Jul 1 had 16 as a top single, 14 sustainable). Consolidate 20×12 across all sets before adding |
| Arnold press (DB)               | Vertical press            | G1·G2 | Upper 8–12            | —                                  | —           | `SHOULDER_PRESS` / `DUMBBELL_ARNOLD_PRESS` ⚠ guess                    | full-ROM delt sweep                                       |
| Push press (BB/DB)              | Vertical press            | G1·G2 | Upper 5–8             | —                                  | —           | `SHOULDER_PRESS` / `BARBELL_PUSH_PRESS` ⚠ guess                       | leg-drive power option                                    |
| Cable crossover                 | Chest accessory           | G1    | Upper 12–15           | 20 kg × 12, 15, 15                 | 2026-07-20  | `FLYE` / `CABLE_CROSSOVER` ✓ 06-16                                    | dual pulley — G1 only; 20 kg now holds the top of the rep range — **load up next** |
| Low-to-high cable flye          | Chest accessory           | G1    | Upper 12–15           | 10 kg × 15, 15, 12 (seeded)        | 2026-07-13  | `FLYE` / free-entry                                                   | dual pulley; upper-chest bias (single-arm possible at G2); Jul 13 seeded 10 kg/side, top of rep range (cable stack, approx) |
| Pec-deck flye                   | Chest accessory           | G2    | Upper 12–15           | —                                  | —           | `FLYE` / free-entry                                                   | G2 machine                                                |
| DB flye                         | Chest accessory           | G1·G2 | Upper 12–15           | —                                  | —           | `FLYE` / `DUMBBELL_FLYE` ⚠ guess                                      | flat/incline bench                                        |
| Bench dip (weighted)            | Triceps / dips            | G1·G2 | Upper 8–15            | +10 kg × 12, 15, 15                | 2026-07-13  | `TRICEPS_EXTENSION` / `BENCH_DIP` ✓ 06-16                             | Jul 13 ran +10 kg (not the +12.5 target), reps maxed 15,15 → **load to +12.5 next** |
| Dips (full, bodyweight)         | Triceps / dips            | G2    | Upper 8–12            | BW × 8, 8, 7                       | 2026-06-16  | `TRICEPS_EXTENSION` / `DIP` ⚠ guess                                   | needs dip station — G2 only; add load once 3×12           |
| Cable triceps pushdown          | Triceps / dips            | G1·G2 | Upper 10–15           | 35–40 kg × 9–15 (30 warm-up)       | 2026-07-01  | `TRICEPS_EXTENSION` / `TRICEPS_PRESSDOWN` ✓ 06-19                     | high pulley; rope or bar; working range 35–40, start at 35 |
| Overhead cable triceps ext      | Triceps / dips            | G1·G2 | Upper 10–15           | 20–25 kg × 11–15 (seeded)          | 2026-07-02  | `TRICEPS_EXTENSION` / free-entry                                      | long-head stretch; Jul 2 ramped 10→20→25 kg, working range 20–25 (cable stack, approx) |
| DB lateral raise                | Lateral / delts           | G1·G2 | Upper 12–15           | 8 kg × 15, 15, 15                  | 2026-07-20  | `LATERAL_RAISE` / `DUMBBELL_LATERAL_RAISE` ✓ 06-16                    | **Jul 20: 15 across — top of the rep range on every set. Load to 10 kg.** |
| Cable lateral raise             | Lateral / delts           | G1·G2 | Upper 12–20           | 10 kg × 12, 12, 11 (seeded)        | 2026-07-02  | `LATERAL_RAISE` / free-entry — ⚠ not `CABLE_LATERAL_RAISE` (drops 06-19) | single-arm constant tension; name in step description. Reps faded 12→11 — real working load (cable stack, approx) |
| Lat pulldown                    | Vertical pull             | G1·G2 | Upper 6–10            | 110 kg × 10, 10, 8                 | 2026-06-29  | `PULL_UP` / `LAT_PULLDOWN` ✓ 06-17                                    | G1 dual high anchor / G2 high pulley; **hit 110×10 (Jun 29)** — progression trigger met, next add load or 110×10 across |
| Pull-ups (strict)               | Vertical pull             | G2    | Upper 5–10            | BW × 5, 5, 3                       | 2026-05-28  | `PULL_UP` / `PULL_UP` ⚠ guess                                         | needs pull-up bar — G2 only                               |
| Straight-arm cable pulldown     | Vertical pull             | G1·G2 | Upper 12–15           | 15–20 kg × 12–15                   | 2026-06-23  | `PULL_UP` / free-entry                                                | high pulley, lat isolation; Garmin auto-tags PULL_UP (mislabel) |
| Barbell row                     | Horizontal row            | G1·G2 | Upper 8–12            | 50 kg × 10, 10, 8                  | 2026-06-29  | `ROW` / `BARBELL_ROW` ✓ 06-17                                         | 4 working sets @ 50 kg (06-29, hit 10s); push reps to 12 before loading |
| DB row (1-arm)                  | Horizontal row            | G1·G2 | Upper 8–12            | 20 kg/hand × 12, 10                | 2026-06-29  | `ROW` / `DUMBBELL_ROW` ✓ 06-23                                        | ran 20 kg Jun 29 (under the 22.5 target — conservative); rebuild to 22.5 |
| Chest-supported DB row          | Horizontal row            | G1·G2 | Upper 8–12            | 20 kg/hand × 10–12                 | 2026-06-23  | `ROW` / `DUMBBELL_ROW` ✓ 06-23                                        | incline bench, strict                                     |
| Seated cable row                | Row accessory             | G2    | Upper 10–12           | 55 kg × 10–12                      | 2026-06-12  | `ROW` / `SEATED_CABLE_ROW` ✓ 06-17                                    | low pulley — G1 can't do cable rows                       |
| Single-arm cable row            | Row accessory             | G2    | Upper 10–12           | —                                  | —           | `ROW` / free-entry                                                    | low pulley — G2 only                                      |
| Face pull                       | Rear delt                 | G1·G2 | Upper 15–20           | 35 kg × 15, 15, 15                 | 2026-06-29  | `ROW` / `FACE_PULL` ✓ 06-17                                           | high pulley + rope                                        |
| Cable reverse fly (X)           | Rear delt                 | G1    | Upper 15–20           | 10 kg × 15, 15, 13                 | 2026-07-02  | `FLYE` / free-entry — ⚠ not `CABLE_REVERSE_FLY` (drops 06-23)         | dual pulley cross — G1; name in step description; 10 kg is the working load |
| Reverse fly / rear-delt (DB)    | Rear delt                 | G1·G2 | Upper 15–20           | —                                  | —           | `FLYE` / free-entry — ⚠ not `DUMBBELL_REVERSE_FLY` (drops 06-19) | prone on incline bench; name in step description                                    |
| Barbell curl                    | Biceps                    | G1·G2 | Upper 10–12           | 27 kg × 12, 10, 9                  | 2026-06-29  | `CURL` / `BARBELL_BICEPS_CURL` ✓ 06-17 — ⚠ not `BARBELL_CURL` (drops) | last set 7→9 vs Jun 17 — creeping up                      |
| Incline DB curl                 | Biceps                    | G1·G2 | Upper 10–12           | 10 kg × 12, 9 (then 8 × 12)        | 2026-07-02  | `CURL` / `INCLINE_DUMBBELL_BICEPS_CURL` ✓ 06-19                       | stretch bias on incline bench; 10 kg held 2 sets, dropped to 8 for reps — 10 is top |
| Hammer curl                     | Biceps                    | G1·G2 | Upper 10–12           | 12 kg × 12 (then 10 × 12)          | 2026-07-02  | `CURL` / `DUMBBELL_HAMMER_CURL` ✓ 06-19                               | 12 kg set 1, dropped to 10 for set 2                     |
| Cable curl                      | Biceps                    | G1·G2 | Upper 10–12           | —                                  | —           | `CURL` / `CABLE_BICEPS_CURL` ⚠ guess                                  | low pulley; Bayesian (behind body) for stretch            |
| Romanian deadlift               | Hinge (leg primary)       | G1·G2 | Leg 4–6 heavy         | 60 kg × 6 × 4                      | 2026-06-11  | `DEADLIFT` / `ROMANIAN_DEADLIFT` ✓ 06-11                              | RDL loads hamstrings harder at equal load                 |
| Barbell deadlift (conventional) | Hinge (leg primary)       | G1·G2 | Leg 4–6 heavy         | 70 kg × 5 × 2 (top single 70 × 8) | 2026-06-23  | `DEADLIFT` / `BARBELL_DEADLIFT` ✓ 06-23                               | Jun 23 ramped 60/65/70×5×2 submaximal (RIR 2–3)          |
| Single-leg RDL (DB/KB)          | Hinge / single-leg        | G1·G2 | Leg 8–10/leg          | —                                  | —           | `DEADLIFT` / `SINGLE_LEG_ROMANIAN_DEADLIFT` ⚠ guess                   | balance + ham; leg-curl substitute                        |
| Kettlebell swing                | Hinge (power)             | G1    | 3–5 × 10–15           | —                                  | —           | `HIP_SWING` / `KETTLEBELL_SWING` ⚠ guess                              | KB only (G1); capped at 20 kg                             |
| Cable pull-through              | Posterior chain           | G1·G2 | Leg 10–12             | —                                  | —           | `HIP_RAISE` / free-entry                                              | low pulley + rope, hinge — back-extension substitute      |
| Barbell hip thrust              | Posterior chain / glute   | G1·G2 | Leg 6–10              | —                                  | —           | `HIP_RAISE` / `BARBELL_HIP_THRUST` ⚠ guess                            | bench-supported                                           |
| Back extension                  | Posterior chain           | G1·PT | Upper 8–15            | 60 kg × 9, 9, 9                    | 2026-06-29  | `HYPEREXTENSION` / `BACK_EXTENSION` ⚠ guess — Garmin auto-detect mislabels it `CABLE_CRUNCH` | Weight-stack machine at **G1** + PT. Up from 50×13 (Jun 12) |
| Back squat                      | Squat (leg primary)       | G1·G2 | Leg 4–6 heavy         | 70 kg × 5 top (60×5×2 build)       | 2026-06-25  | `SQUAT` / `BARBELL_BACK_SQUAT` ✓ 06-25                                | straight-set 5s; tempo base May 28                        |
| Front squat                     | Squat (leg primary)       | G1·G2 | Leg 4–6               | —                                  | —           | `SQUAT` / `BARBELL_FRONT_SQUAT` ⚠ guess                               | quad bias; leg-press substitute                           |
| Goblet squat (DB/KB)            | Squat (leg primary)       | G1·G2 | Leg 8–12              | —                                  | —           | `SQUAT` / `GOBLET_SQUAT` ⚠ guess                                      | KB only at G1 (≤20 kg); warm-up or volume                 |
| Leg press                       | Squat (leg primary)       | PT    | Leg 4–6 heavy         | TBD                                | 2026-06-11  | `SQUAT` / `LEG_PRESS` ✓ 06-11                                         | PT machine (sub: front/goblet squat)                      |
| Bulgarian split squat           | Single-leg (prehab dose)  | G1·G2 | Leg 2×8 light         | 12 kg/hand × 8–10/leg              | 2026-06-25  | `LUNGE` / free-entry                                                  | per-hand confirmed (Jun 25)                               |
| Walking lunges (DB/BB)          | Single-leg                | G1·G2 | Leg 8–10/leg          | —                                  | —           | `LUNGE` / `WALKING_LUNGE` ⚠ guess                                     |                                                           |
| Reverse lunge (DB/BB)           | Single-leg                | G1·G2 | Leg 8–10/leg          | —                                  | —           | `LUNGE` / `REVERSE_LUNGE` ⚠ guess                                     | knee-friendly                                             |
| Leg curl                        | Hamstring                 | PT    | Leg 8–10 mod          | by feel                            | 2026-06-11  | `LEG_CURL` / free-entry                                               | PT machine (sub: Nordic / single-leg RDL)                 |
| Nordic ham curl                 | Hamstring                 | G1·G2 | 3 × 5–8               | BW × 8 × 3                         | 2026-06-25  | `LEG_CURL` / free-entry                                               | foot anchor (bench/partner); leg-curl substitute          |
| Leg extension                   | Quad accessory            | PT    | Leg 10                | 25 kg × 10 × 3                     | 2026-06-11  | `LEG_CURL` / ⚠ check category                                         | PT machine; single-leg 30 kg × 8/leg (May 28)             |
| Standing calf raise (DB/BB)     | Calf                      | G1·G2 | Leg 8–10 heavy-paused | by feel                            | 2026-06-11  | `CALF_RAISE` / `STANDING_CALF_RAISE` ✓ 06-11                          | load up per leg respec                                    |
| Seated DB calf raise            | Calf                      | G1·G2 | Leg 10–15             | —                                  | —           | `CALF_RAISE` / `SEATED_CALF_RAISE` ⚠ guess                            | soleus bias; DB on knee                                   |
| Box / broad jumps               | Plyo (leg)                | G1·G2 | 3–4 × 5 contacts      | —                                  | —           | `PLYO` / `BOX_JUMP` ✓ 06-25                                           | bench as box; explosive block                             |
| Broad jump                      | Plyo (leg)                | G1·G2 | 3–4 × 3–5             | —                                  | —           | `PLYO` / free-entry                                                   | horizontal power vector                                   |
| Jump squat (light)              | Plyo (leg)                | G1·G2 | 3–4 × 5               | —                                  | —           | `PLYO` / free-entry                                                   | in place, land soft; no box; vertical power option        |
| Plank                           | Core anti-extension       | G1·G2 | 3 × 30–45 s           | BW (3 × 40 s)                      | 2026-07-13  | `PLANK` / `PLANK` ✓ 06-16                                             | time end-condition                                        |
| Ab-wheel rollout                | Core anti-extension       | G1·G2 | 3 × 8–12              | —                                  | —           | `CORE` / free-entry                                                   | needs an ab wheel — confirm available                     |
| Side plank                      | Core anti-lateral-flexion | G1·G2 | 3 × 30–45 s           | —                                  | —           | `PLANK` / `SIDE_PLANK` ✓ 06-19                                        | time end-condition                                        |
| Pallof press                    | Core anti-rotation        | G1·G2 | 3 × 10–12/side        | 20 kg × 12/side                    | 2026-07-20  | `CORE` / free-entry                                                   | single cable; Jul 20 ran 20 kg on the reduced-volume day (25 kg Jul 13 is the standing working load) |
| Half-kneeling cable chop        | Core anti-rotation        | G1·G2 | 3 × 10–12/side        | 30 kg × 15 (25 warm-up)            | 2026-07-01  | `CHOP` / `CABLE_WOODCHOP` ✓ 06-17                                     | single cable; reps ran long at 30 kg                     |
| Hanging knee raise              | Core dynamic              | G2    | 3 × 10–12             | BW                                 | 2026-06-11  | `CRUNCH` / free-entry                                                 | needs pull-up bar — G2 only                               |
| Hanging leg raise               | Core dynamic              | G2    | 3 × 8–12              | BW                                 | —           | `LEG_RAISE` / `HANGING_LEG_RAISE` ⚠ guess                             | needs pull-up bar — G2; harder than knee raise            |
| Cable crunch                    | Core dynamic              | G1·G2 | 3 × 10–12             | ~60 kg × 10                        | 2026-06-25  | `CRUNCH` / `CABLE_CRUNCH` ✓ 06-19                                     | high pulley + rope, kneeling                              |
| Suitcase carry                  | Carry / stability         | G1·G2 | 3 × 30–40 m/side      | 24 kg                              | 2026-06-17  | `CARRY` / free-entry — ⚠ not `SUITCASE_CARRY` (dropped 06-29, 07-22)  | DB/KB; time end-condition (per side). Survived once (06-17) then dropped on both later uploads — **stop re-trying the enum**; upload with the `CARRY` category and the movement name in the step description. |
| Farmer's carry (2 KB/DB)        | Carry / stability         | G1·G2 | 3 × 30–40 m           | —                                  | —           | `CARRY` / `FARMERS_WALK` ⚠ guess                                      | KB only at G1 (≤20 kg)                                    |

> **Calves not programmed (athlete preference, 2026-06-30):** the athlete will not train calves directly — his calves are already large/disproportionate and he does not want added size. The two calf-raise rows above are retained for history/enums only — **do not select them**. The run-relevant Achilles/calf-stiffness role is covered by the plyo block + running.
>
> **Lower-body programming note (leg respec 2026-06-12):** legs are **not** a hypertrophy target. Primary lift 3–4×4–6 heavy at RIR 2–3 (load-at-fixed-reps progression), explosive/plyo block, single-leg as a 2×8 prehab dose, hamstring curl + heavy calves as strain insurance. See `training.md` § Leg Day.
>
> **Gym note:** at **G1** (default) there are no cable rows, no full dips, no pull-ups, and KB work caps at 20 kg — program barbell/DB rows, bench dips, and lat pulldown instead. The PT-tagged leg machines (leg press, leg extension, leg/ham curl) aren't selectable on self-directed days; use their free-weight substitutes (front/goblet squat, RDL, Nordic curl, cable pull-through). **Exception: G1 has a weight-stack back-extension machine** (confirmed 2026-06-29) — back extension is freely programmable on self-led days.
