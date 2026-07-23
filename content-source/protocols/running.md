# RUNNING PROTOCOL - MASTER

## Key Context

Primary limiter remains cardiovascular, not muscular. Post-smoking aerobic development still matters. Pace discipline stays secondary to HR and RPE on easy days and in hot weather. Lactate-tested 2026-04-28 (FCDEFUC): LT1 145 bpm @ 5:52/km, LT2 172 bpm @ 5:00/km, lab-prescribed individual threshold 142 bpm @ 6:00/km. The 10K PR pace (5:00/km) sits exactly at LT2 — current 10K racing is a threshold effort.

## HR Zones (lactate-anchored, 2026-04-28)

| Zone | Name          | HR Range  | % of LT2 | Purpose                                            |
| ---- | ------------- | --------- | -------- | -------------------------------------------------- |
| 1    | Recovery      | <125      | <73%     | Walk breaks, shakeouts, recovery jogs              |
| 2    | Aerobic Base  | 125-142   | 73-83%   | Easy runs, long runs, base building (cap = lab IT) |
| 3    | Aerobic Dev   | 143-155   | 83-90%   | Steady aerobic, marathon-pace work                 |
| 4    | Sub-Threshold | 156-168   | 91-98%   | Norwegian / cruise intervals (just under LT2)      |
| 5    | Threshold     | 169-175   | 98-102%  | Tempo, threshold reps, 10K race effort             |
| 6    | VO2max        | 176-185   | 102-108% | Hard intervals, late-race surge                    |
| 7    | Anaerobic     | >185      | >108%    | Sprints, final kick                                |

Anchors: LT1 = 145, LT2 = 172, max ~190 (race-observed). Treadmill ≈ outdoor at same HR — pace differs, HR doesn't.

**Athlete compressed-range note (2026-06-13):** this athlete cannot run below ~130 bpm — below that is a walk, not a jog. Two consequences for the zone table: (1) **Zone 1 (<125) is walk-only** — "recovery jogs" do not exist down there; a real recovery jog runs ~135–145. (2) The **functional easy-running band is ~135–142**, not the full 125–142 — a ~7 bpm window pinned just under the cap. Easy runs intrinsically sit near the 142 ceiling (logged easy runs average ~138–142); brief drift to 143–145 is this athlete's natural easy ceiling, governed by RPE/conversation, not a discipline failure. The easy–to–sub-T gap is only ~10 bpm (142 → 152), so easy and sub-T cannot be separated by HR alone — RPE and pace must do that work. This is also why outdoor easy pace-at-HR is a noisy fitness signal (always at the rail) and the treadmill control run is the cleaner read.

### Garmin Device Calibration (2026-06-11)

The Garmin watch only offers a 5-zone HR model (no native lactate-threshold anchor), so zones are entered in **BPM** to honor the lab. Mapping to Garmin's 5 zones: Warm Up ≥95, Easy ≥120, Aerobic ≥143, Threshold ≥158, **Maximum ≥172 (= LT2)**. This is a coarse on-watch display only; real training stays governed by the 7-zone table above and per-session HR targets.

**Running power:** Garmin auto-detected FTP (403 W) was inflated — above the athlete's hardest recorded effort. Threshold Power was set manually to **360 W**, derived from the Ansião 10K (May 17) normalized power of 371 W (52-min effort at avg HR 176, slightly above LT2). Garmin's default power-zone percentages are kept (threshold = 100% at the Z3/Z4 boundary). Power is not lab-measured and is not a training governor here — it exists only so the watch's power gauge and power-based Training Effect are not wrong.

### Easy-Run Rules

| Environment | Ceiling | Spike Max | Typical Pace            |
| ----------- | ------- | --------- | ----------------------- |
| All         | 142 bpm | 145 bpm   | 6:40-7:30/km treadmill, 6:30-7:30/km outdoor |

- Easy = RPE 3-4 and full conversation.
- If RPE exceeds 5, slow down even if HR looks acceptable.
- Recovery jogs run **~135–145 bpm** — this athlete can't jog below ~130 (Zone 1 is walk-only), so don't chase a sub-133 "recovery jog" that doesn't exist for this physiology. Govern recovery by easing effort and letting HR fall, not by a walk-level number.
- **Weekly treadmill control run (2026-06-12):** one of the week's easy runs is done on the treadmill under fixed conditions — ~30 min, HR capped at 142, same incline every time (1%). This is the heat-independent fitness signal: outdoor pace-at-HR is confounded by season, so the control run is the only easy-run pace series that is compared week to week. Log it as a normal easy run; `/report` reads its pace-at-HR trend.

## Pre-Run Warm-Up (Daily 5)

1. Pogo Hops - 30s
2. A-Skips - 30s
3. Leg Swings (Front/Back) - 30s/side
4. Leg Swings (Lateral) - 30s/side
5. Walking Lunges - 30s

## Current Periodization

Everything through the May race block is complete (Base → Quality Reintro → HM-Specific → HM taper + race Mar 29 → Post-HM Recovery → Base Rebuild → May races: Ansião 10K May 17, Anadia 14.7 km trail May 24). Live and upcoming:

| Phase                  | Dates           | Focus                                                   | Volume      |
| ---------------------- | --------------- | ------------------------------------------------------- | ----------- |
| Cut Block 1 (CURRENT)  | May 30 - Jul 5  | 2 quality/wk (1 harder + 1 lighter), 10K pace from wk 4 | 35-42 km/wk |
| Cut Block 2            | Jul 6 - Aug 30  | 2 quality/wk, synchronized deload every 3rd wk          | 35-40 km/wk |
| 10K Peak               | Sep 1 - Oct 25  | 2 quality/wk + selective VO2max, taper                  | 45-55 km/wk |

## Race Schedule

| Date             | Distance        | Race         | Priority   | Result / Target                          |
| ---------------- | --------------- | ------------ | ---------- | ---------------------------------------- |
| May 17 (Sun)     | 10K (road)      | Ansião 10K   | Done       | 52:16 / 5:13/km, avg HR 176 (raced hard) |
| May 24 (Sun)     | 14.7 km (trail) | Anadia trail | Done       | 2:07:42, avg HR 172, 413 m climb         |
| ~~Jun 20~~       | ~~10K~~         | —            | Dropped    | **Benchmark dropped (2026-06-16).** No mid-cut 10K race; Saturday is an easy/leisure run. No result to gate on — the decision-gate is void. Next real fitness validation is the September Phase 6 build. |
| **Oct 25 (Sun)** | **10K**         | **TBD**      | **A-Race** | **Sub-47:00 (stretch 46)** — retained but unvalidated until the Sep Phase 6 build; rides on the Phase 4-5 scoreboard (VO2max proxy ≥47 / ≤50:30, control-run trend, quality execution at HR) |

## Workout Types

### Easy/Base Runs

- **HR:** functional band **~135-142** (cap = lab individual threshold 142 bpm; the old 148 outdoor ceiling is retired). The athlete's easy gait sits near the cap — below ~130 is a walk, so the usable easy window is the top ~7 bpm of Zone 2, not the full 125–142.
- **Pace:** 6:30-7:30/km outdoor, 6:40-7:30/km treadmill
- **Duration:** 30-60 min
- **RPE:** 3-4

### Long Runs

- **HR:** ~135-142, drift ceiling 145 (LT1) when prescribed
- **Duration:** 75-120 min depending on phase
- **RPE:** 4-5
- Long runs over 90 min use quality-day fueling.

### Sub-Threshold Intervals

| Session          | Structure        | HR Target      | Recovery      |
| ---------------- | ---------------- | -------------- | ------------- |
| Norwegian Long   | 3x10 to 4x10 min | 152-165        | 60-90 sec jog |
| Norwegian Short  | 8-10x3 min       | 152-165        | 45-60 sec jog |
| Cruise Intervals | 5-6x1 km         | 152-165        | 60-90 sec jog |
| HM-pace          | 4-6x2 km         | Goal HM effort | 60 sec jog    |

All sub-T sessions target **152–165 bpm** (≈2.5–3.5 mmol/L, between LT1 145 and LT2 172). Longer reps (Norwegian Long) sit toward the low end (~152–160); shorter reps (Cruise/Short) can reach ~165. **Hard ceiling 168** — past that you've drifted into threshold (athlete tendency: Jun 2 reps spiked to 179, over-cooked). HR is lactate-anchored and environment-independent — the same numbers apply on the treadmill.

### Tempo (threshold)

- **HR:** 165-172 — at or just under LT2 (172). This is the distinct **threshold** stimulus: it sits at the top of Zone 4 into Zone 5, deliberately higher than the sub-T working band (152–165) — a continuous tempo ramps up to LT2 and holds just under it, while the sub-T sessions stay below.
- **Structure:** 20-30 min continuous
- **RPE:** 7-8
- Hold at/just under LT2. If HR climbs past 172 you're racing the tempo, not running it — back off; that turns a steady threshold piece into a threshold-rep/VO2 effort.

### 10K-Pace Intervals

- **Governor:** HR/effort, not pace. Run reps at 168-174 bpm (around LT2 172) at RPE 8-9.
- **Pace:** currently ~4:55-5:05/km — current 10K race pace (≈5:00/km) sits right at LT2. Goal pace 4:42/km (sub-47) is a **convergence target**: the pace earned at the same HR as fitness rises, not a number to force from day one. Forcing 4:42 now drives HR into the VO2 zone (176+) and turns this into a VO2 session rather than threshold work.
- **Structure:** 6-8x1 km or 4-5x1.5 km with 60 sec jog
- **RPE:** 8-9
- Introduce in Cut Block 1 (from week 4). This is the core 10K-specific session.

### VO2max Intervals

- **HR:** 175-185 by end of rep
- **Pace:** faster than 10K pace, usually 400-1000 m reps
- **RPE:** 9-10
- Reserve for late Cut Block 1 and Phase 6 when recovery and calories support it.

### X-Element

- Hill sprints: 6-8x10-15 sec
- Strides: 4-8x20 sec after easy runs
- Short reps: 6-8x200 m at mile effort

## Quality Session Selection (derive before prescribing)

Before naming the week's harder quality run, do not reach for the session in the athlete's words ("speed work") or the prior day's frame — derive it. Answer these, and surface the derivation in one or two lines in the `/plan` summary:

1. **Recent quality history** — the last 2–3 quality session types (read the daily files). Don't repeat a stimulus blindly or skip a rung.
2. **Ladder + phase week** — the current rung on sub-T → threshold → 10K-pace → VO2, and what the phase/week schedules (e.g. 10K-pace enters Cut Block 1 wk4; VO2 is late Cut Block 1 / Phase 6). The default session is the **next correct rung**.
3. **Block gap** — the under-trained stimulus this block; bias toward closing it.
4. **Recovery + trailing load** — can today carry the intended intensity, or does it down-dose one rung?
5. **Goal relevance** — what the next race actually needs *now* (threshold base before speed sharpening for the October 10K).

Pick the session this produces. If it deviates from the next rung — pulled forward or held back — log the explicit reason in the daily file. Garmin's Daily Suggested Workout is a useful independent cross-check, not an authority (its pace targets are heat-blind; govern by HR). A 22-min threshold tempo, not 10K-pace intervals, is the wk3 default after a sub-T-only block (2026-06-16 lesson).

## Weekly Rules by Phase

Scheduling is fully flexible across the week (Thursday no-running rule retired 2026-05-28). The rules below describe **session counts and spacing**, not weekday assignment.

- **Phase 1:** easy-only running. No quality work.
- **Phase 2:** one quality session per week. Long run on the weekend.
- **Phase 3:** sharpen, race, recover. No heavy taper and no hard legs in the last 3 days before a race.
- **Phases 4-5:** two quality sessions per week (one harder, one lighter) with ≥72 h between them; long run on the weekend; legs needs ≥36 h before the next quality run and never stacks with a hard run on the same day.
- **Phase 4 volume note (~35-42 km/wk, ceiling relaxed 2026-06-03):** the original 30-35 cap was lifted because the two quality sessions are a deliberate, athlete-chosen motivation / 10K-specificity priority, and with the quality + long-run trio already near ~30 km only one easy run fit under the old ceiling. The athlete chose to raise the cap rather than cut easy runs. The added load is **easy** km, which moves the week back toward 80/20 rather than degrading it. The long run stays **12-14 km** (≤~35-40% of the week); the lighter quality session stays genuinely short (~5-6 km of work). The band is a guide, not a hard cap: **recovery markers govern** — if flags stack, the lighter quality session is the first thing to downgrade to easy. The higher mileage raises TDEE modestly (~+70 kcal/day at the top of the band); the ~Jun 11 14-day weigh-in read absorbs it (add carbs back if loss runs >0.4 kg/wk or strength/LBM dips).
- **Phase 4 volume floor (2026-06-12): 30 km/wk minimum, enforced.** The Apr-May trough (weeks of 10-15 km while the narrative said "aerobic fitness intact") cost real fitness — VO2max estimate 49→47, easy-run efficiency −4%. Consistency at 30-38 km/wk through the cut matters more than any single session's design. A week below 30 km (outside illness, injury, or a declared fallback week) is a protocol breach: it triggers a logged corrective action in the coaching log, same as ACWR >1.5.
- **Phase 4-5 running success metrics (2026-06-12):** easy-run pace is **off the scoreboard until September** — it is sacrificed to the deficit and the season by design, and is not a failure signal. The cut-phase running scoreboard is: (1) heat-adjusted efficiency (treadmill control run pace-at-HR) stable within ~2%, (2) both weekly quality sessions completed at target HR, (3) VO2max estimate holds ≥47 — read via the Garmin race-time prediction as proxy (10K not slower than ~50:00-50:30), since the direct VO2max endpoint is unreliable, (4) weekly volume ≥30 km. Pace-at-HR improvement is a Phase 6 deliverable, not a Phase 4-5 one.
- **Phase 4 weeks 1-3:** the harder quality session is the sub-T / Norwegian work; the lighter one is aerobic-development or short sub-T. 10K-pace work enters from week 4.
- **Q2 survivability rule (2026-06-12):** the second quality session has structural attrition — when a session is missed every week, the schedule is wrong, not the athlete. On any compromised week (readiness flags, family disruption, time pressure), Q2 converts to **6×20 s strides or 6×10-15 s hill sprints appended to an easy run** instead of being skipped. A 10-minute quality touch that happens beats a 40-minute session that doesn't. This conversion counts as Q2 completed for compliance.
- **Phase 5:** cap volume at 40 km/week. If 7-day HRV average drops >10% below baseline, downgrade the lighter quality session of the week to an easy aerobic run.
- **Phase 5 deload weeks:** every 3rd week reduce run volume 15-20% and keep only one quality session.
- **Phase 6:** keep two quality sessions per week, add selective VO2max, taper last 2 weeks.

## Heat and Weather Adaptation

Portugal summer conditions change the session.

- If temperature is `>=18 C` or dew point is `>=16 C`, anchor the run to HR and RPE, not pace.
- Expect roughly 3-5 sec/km pace loss at the same effort in warm conditions. Do not chase normal splits.
- If temperature is `>=24 C`, shorten quality-session volume 10-20% unless the workout is done very early or late.
- If temperature is `>=24 C`, take 500-800 mg sodium with about 400 mL water 60 minutes pre-run for quality sessions and long runs.
- Prefer outdoor quality before 09:00 or after 19:30 in summer.
- For easy runs in heat, walk 20-30 sec if HR drifts above target instead of forcing shuffle pace.
- For trail or long runs >75 min in heat, carry fluids.

## Monitoring

### ACWR

Acute km this week / 4-week rolling average.

| ACWR    | Status          | Action                 |
| ------- | --------------- | ---------------------- |
| 0.8-1.3 | Sweet spot      | Continue               |
| 1.3-1.5 | Caution         | Hold or trim next week |
| >1.5    | Danger          | Reduce volume          |
| <0.8    | Detraining risk | **Enforced (2026-06-12):** log a corrective action in the coaching log and rebuild toward the 30 km floor next week. This flag fired silently through the Apr-May trough; it is no longer advisory. |

### Warning Signs

- Easy-run HR elevated 5+ bpm above baseline for 3 runs -> extra rest day
- Sleep score <60 for 2 nights -> replace quality with easy
- RHR elevated 5+ bpm above baseline -> reduce weekly volume 20%
- HRV drops >15% from 7-day average -> optional rest day or quality downgrade
- In Phase 5, tighten the HRV rule: if the 7-day HRV average falls >10% below baseline, remove the Friday quality session that week
- Body Battery <30 at wake -> full rest day
- Heat + poor sleep on the same day -> no intensity

## Taper and Race Execution

### 10K A-Race (October 25)

- Warm-up: 15-20 min jog + 4-6 strides
- Pacing: start 4:50/km, settle 4:42-4:46 by km 3, hold through km 8, kick km 9-10 (stretch pacing: 4:36-4:39 if fitness supports it)
- No in-race fueling needed
- Caffeine: ~230 mg 30-60 min pre-race
- Final 10 days: reduce volume, not intensity. Keep one short 10K-pace touchpoint each week.

### Phase 6 Quality-Day Warm-Up Upgrade

On the 2 weekly quality sessions in Phase 6, extend the Daily 5 with one short power-focused drill after the jog warm-up:

- Broad Jumps - 3x5, or
- Power A-Skips - 3x20 m

Keep the contacts crisp and low-fatigue. This is for stiffness and elastic return, not conditioning.

### Race-Week Running Pattern

- **10 days out:** last substantial long run
- **7 days out:** last real threshold session, reduced total volume
- **4-5 days out:** short 10K-pace sharpening only
- **2 days out:** 20-30 min easy + 4 strides or full rest if warm conditions and fatigue demand it
- **1 day out:** rest or 15 min shakeout only

## Post-Race Recovery Rules

### After benchmark 10K races

- 48 hours: easy walking, mobility, no lower-body lifting
- 72 hours: easy run only if legs feel normal and no pain >2/5
- Resume full week only if sleep, HR, and soreness normalize

### After trail 21K or HM

- 3 days minimum without quality work
- 5-7 days before hard lower-body lifting returns
- Keep calories at maintenance for 2 days post-race

## Longer-Race Fueling Reference

Generic reference for any future HM or trail race around 90-120 minutes. None is currently on the calendar — the A-race is a 10K, which needs no in-race fuel — so this is kept only for if a longer event is added.

- Carb load 36-48 h pre-race: 6-8 g/kg/day carbohydrate
- Race breakfast 3-4 h pre-start: 1-1.5 g/kg carbohydrate
- In-race: 30-45 g carbohydrate/hour
- Fluids: 400-700 mL/hour adjusted by weather and thirst
- Sodium: 300-600 mg/hour in moderate-to-warm conditions
- Practice mid-run fueling on 2-3 long runs >75 min in the weeks before any such race, using race-day products.

## Data Files

- `data/activities.csv`
- `data/sleep.csv`
- `data/stats.csv`
- `data/hrv.csv`
- `data/body_battery.csv`
- `data/stress.csv`
- `data/race_predictions.csv`
