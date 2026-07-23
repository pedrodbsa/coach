# MEAL ROTATION - MASTER

> Companion to `nutrition.md`. A fixed set of portion-locked meals so the day can be eaten to plan
> without logging every item. `nutrition.md` holds the authoritative Phase 4 calorie tiers; these cards
> are the eating mechanism for hitting them.
> Last verified: 2026-05-31.

> **Phase 4 target correction (2026-05-29 TDEE recalibration).** The cards below were originally built to
> the draft Phase 4 tiers (Rest 1,850 / Easy 2,050 / Quality 2,300 / Long 2,500). `nutrition.md` has since
> trimmed those by ~100 kcal/day to **Rest 1,750 / Easy 1,950 / Quality 2,200 / Long 2,400** (avg ~2,000).
> The cards are **not** re-derived here — that 100 kcal sits inside the eyeballing noise of portion-locked
> eating and the figure stays provisional until the ~Jun 11 weigh-in reconfirm. To hit the corrected target,
> shave one carb portion on the highest days (drop ~one mug of cooked rice/potato, or the oats from the
> post-session shake). The 7-day weight trend is the real governor. Once Jun 11 confirms the final tier, the
> cards get re-anchored once.

> **Athlete default — Greek yogurt: always 2% fat.** All yogurt in this file and in `/plan` outputs is 2% unless explicitly stated otherwise. Substitute 0% only if the active phase's lowest calorie tier needs the fat trim (per-100 g delta vs 2%: −14 kcal, −2 g F).

## Purpose

This file exists to replace daily food logging with standardised meals. Each meal below is portion-locked
and its macros are pre-computed, so "tracking" becomes "I ate L2 at the Easy portion" — nothing to weigh
into an app, nothing to calculate. The work is done once, here, instead of at every meal forever.

Detailed logging stays optional: one full-log calibration day per month is enough to confirm the eyeball
has not drifted. The daily weigh-in is non-negotiable — with logging gone, the 7-day weight trend is the
primary feedback loop that governs the cut.

## How It Works

**One mechanic: the day type sets the carb portion.** Every meal has a fixed protein/fat/vegetable anchor
that never changes. Only the carbohydrate component scales. `/plan` assigns the day type each morning;
read that one word, then use the matching column.

| Day type        | What it is                                  | Carb portion |
| --------------- | ------------------------------------------- | ------------ |
| Rest            | No running, no lifting                      | Rest         |
| Easy / Strength | Easy run or a strength session              | Easy         |
| Quality         | Intervals, tempo, threshold                 | Quality      |
| Long            | Long run                                    | Long         |

**Feeds per day (revised 2026-06-22 — fixed midafternoon snack on every day; see `nutrition.md` § Meal Distribution):**

- **Easy / rest day — 4 feeds:** **small** Breakfast -> **big** Lunch -> **midafternoon snack** -> **big** Dinner. **No post-session shake** — on easy days breakfast is the post-run meal. Breakfast runs small to fund the snack (the snack is funded by the breakfast, not added on top — the day stays on tier). Lunch, snack, and dinner each clear ≥30 g protein.
- **Quality / long / strength day — 5 feeds:** Breakfast (B1-B4) -> Post-session shake -> Lunch -> **midafternoon snack** -> Dinner. The shake is reserved for these sessions; the snack stays small here (the shake already spreads protein) and must not crowd the peri-workout carb.

The **midafternoon snack** is a standing adherence anchor (~15:30-16:30) — it blunts evening appetite and pre-empts night grazing. Use a Snack card (S1-S3 below); skyr clears the 30 g bolus whey-free, the protein-weak Greek yogurt needs ½-1 scoop whey.

Dinner finishes ~3 h before bed on every day. This is a soft eating window — captures the sleep and digestive benefit of time-restricted eating without the LBM cost of a hard fasting protocol.

**Picking meals:** choose any breakfast, lunch, and dinner from the rotation freely. The set is built so
that any combination lands close to target. Lunches are fully yours to standardise. Dinners give options
for the nights you cook; see the family-meal rule for the rest.

**Weights are cooked weight.** Meats and grains are weighed after cooking — that is what you portion out
of a batch. If you weigh raw instead, add roughly 30% for meat and roughly 250% for dry-to-cooked rice.

**Protein powder is measured in scoops, not grams.** All whey doses below are written in ON Gold Standard
scoop fractions. 1 scoop ≈ 30 g powder · ~24 g protein · ~120 kcal · 3 g C · 1 g F. Half-scoop is ~15 g
powder · ~12 g P · ~60 kcal. Use the scoop that ships in the tub; do not weigh on the kitchen scale.

| Whey dose         | Scoop          | Protein | Calories |
| ----------------- | -------------- | ------- | -------- |
| ½ scoop           | half-fill once | ~12 g   | ~60      |
| 1 scoop           | one level      | ~24 g   | ~120     |
| 1½ scoops         | one + half     | ~36 g   | ~180     |

**Small liquid/paste fats are measured in spoons, not grams.** Olive oil, almond butter, and similar
small fat doses are written as tbsp / tsp below — a kitchen scale is too coarse for 5–15 g and a level
spoon is faster anyway.

| Quantity           | Spoon     | ~grams | Notes                                  |
| ------------------ | --------- | ------ | -------------------------------------- |
| 1 tsp olive oil    | 1 tsp     | ~4.5 g | Drizzle-finish                         |
| 1½ tsp olive oil   | 1½ tsp    | ~6.7 g | Pan-sear small portion                 |
| 2 tsp olive oil    | 2 tsp     | ~9 g   | Slightly heavier pan / dressing        |
| 1 tbsp olive oil   | 1 tbsp    | ~13.5 g| Full pan-fry / dressing                |
| 1 tbsp almond butter | 1 tbsp  | ~16 g  | Heaped if thick, level if runny        |
| 1 tbsp chia seeds  | 1 tbsp    | ~10 g  | Level                                  |

## Carb Portion Quick Reference

The scalable carb in each meal, in grams of cooked food (dry for oats). Calibrate a mug or scoop to these
once and you can stop using the scale for carbs entirely.

| Carb food            | Rest  | Easy  | Quality | Long  |
| -------------------- | ----- | ----- | ------- | ----- |
| Rice (cooked)        | 121 g | 143 g | 200 g   | 246 g |
| Potato (boiled)      | 200 g | 235 g | 329 g   | 406 g |
| Pasta (cooked)       | 113 g | 133 g | 187 g   | 230 g |
| Quinoa (cooked)      | 162 g | 190 g | 267 g   | 329 g |
| Oats (dry)           | —     | 67 g  | 93 g    | 115 g |
| Wholegrain bread     | —     | 93 g  | 130 g   | 160 g |

Oats and bread have no Rest column — breakfast is not eaten on rest days.

## Fruit Dessert Swap (athlete preference, 2026-06-18)

The athlete prefers a smaller starch portion at lunch and dinner with a piece of fruit afterwards as
dessert, rather than a large serving of rice or potato. Honour this: cap the starch at a comfortable
portion and take the remaining day-type carbs as fruit, eaten after the meal.

**Mechanic — match by carbohydrate grams so calories and the day-type carb total stay on target.** Cap
the starch around the Easy-tier portion the athlete actually eats (~140–160 g cooked rice, ~235 g potato,
~130 g pasta), then convert the carbs above that into fruit:

- One medium piece of fruit ≈ **20–25 g carbs** ≈ **~80 g cooked rice** / **~145 g boiled potato** / **~75 g cooked pasta**.
- Carb-by-fruit quick reference: peach ~13 g · orange ~15 g · two kiwis ~20 g · apple ~22 g · pear ~25 g · one cup grapes ~26 g · banana ~27 g.

So a Quality lunch specced at 200 g rice becomes ~140 g rice + one apple; a Long-day 246 g becomes
~160 g rice + a banana. `/plan` should present the starch at the comfortable cap and name the fruit that
closes the carb gap.

**Quality / long days:** keep the bulk of the pre- and post-workout carb as starch — fruit (mostly
fructose) refills liver glycogen well but muscle glycogen less directly than starch. The swap is a
top-slice of the portion, not a wholesale replacement; the larger the day's carb target, the more of it
stays as the starch anchor. On easy and rest days this distinction does not matter and the swap is free.

Fruit eaten as dessert does not change the protein or fat anchors — only the scalable carb moves.

## Breakfasts (training days)

On easy/rest days breakfast **runs small** — eggs ± a little oats, or the Breakfast shake (see Shakes section) — because the day now carries lunch, a midafternoon snack, and dinner. A full B-card is a quality/long-day breakfast; on easy/rest days hold it down to ~300 kcal to fund the afternoon snack and keep the day on tier.

Each card: fixed anchor + the carb portion for the day type. Macros are the full meal total.

### Breakfast Oats — Fruit Mix-In (athlete preference, 2026-06-21)

Plain oats are unpalatable to the athlete; mixing fruit in makes the bowl acceptable. For every oat-based
breakfast (B1, B2, B4 — and any `/plan`-specced oat breakfast), take part of the oat portion as fruit
stirred into the bowl rather than serving the full oat weight plain.

**Mechanic — same carb-match rule as the dessert swap above.** Cut the dry oats by ~15–20 g and add fruit
that replaces those carbs, so calories and the day-type carb total stay on target:

- ~20 g dry oats ≈ **13 g carbs** ≈ ~100 g berries / ½ banana / ½ apple chopped in.
- Use the carb-by-fruit quick reference under the dessert-swap section to size it.

Example — a Quality B1 specced at 93 g oats becomes **~73 g oats + 100 g berries stirred in**; an Easy
67 g becomes **~50 g oats + a handful of berries**. The egg/yogurt/whey protein and fat anchors do not
change — only the oat carb moves to fruit. `/plan` should present oat breakfasts in this reduced-oats +
fruit form by default.

### B1 - Eggs & oats
Anchor: 3 whole eggs + 130 g egg whites + cinnamon. Carb: oats.

| Day     | Oats   | Total                       |
| ------- | ------ | --------------------------- |
| Easy    | 67 g   | P42 C41 F20 · 509 kcal      |
| Quality | 93 g   | P45 C57 F22 · 604 kcal      |
| Long    | 115 g  | P48 C70 F23 · 681 kcal      |

### B2 - Greek yogurt bowl
Anchor: 200 g Greek yogurt (2%) + **½ scoop ON whey** + 100 g berries + 18 g almonds. Carb: oats stirred in.

| Day     | Oats   | Total                       |
| ------- | ------ | --------------------------- |
| Easy    | 67 g   | P45 C60 F19 · 594 kcal      |
| Quality | 93 g   | P49 C76 F21 · 689 kcal      |
| Long    | 115 g  | P52 C89 F22 · 766 kcal      |

### B3 - Eggs & toast
Anchor: 3 whole eggs + 190 g egg whites. Carb: wholegrain toast.

| Day     | Bread  | Total                       |
| ------- | ------ | --------------------------- |
| Easy    | 93 g   | P49 C41 F18 · 526 kcal      |
| Quality | 130 g  | P53 C57 F20 · 616 kcal      |
| Long    | 160 g  | P56 C70 F21 · 690 kcal      |

### B4 - Overnight oats
Anchor: 150 g Greek yogurt (2%) + **1 scoop ON whey** + **1½ tbsp chia seeds** + 80 g berries + 25 g almonds. Carb: oats.

| Day     | Oats   | Total                       |
| ------- | ------ | --------------------------- |
| Easy    | 67 g   | P56 C59 F26 · 700 kcal      |
| Quality | 93 g   | P60 C75 F28 · 794 kcal      |
| Long    | 115 g  | P62 C88 F30 · 871 kcal      |

## Shakes

| Shake               | When                  | Build                                                                  | Total                  |
| ------------------- | --------------------- | ---------------------------------------------------------------------- | ---------------------- |
| Post-session shake  | Training days, <30 min post-session | **1½ scoops ON whey** + 1 banana + 5 g creatine            | P37 C30 F2 · 306 kcal  |
| Breakfast shake     | Rest days, morning (07:00-09:00) | **1 scoop ON whey** + 200 g Greek yogurt (2%) + 80 g berries + **1 tbsp almond butter** + 5 g creatine | P48 C20 F14 · 398 kcal |

## Lunches (fully standardised — these are yours)

### L1 - Chicken & rice
Anchor: 130 g chicken breast + 150 g mixed veg + **1 tbsp olive oil**. Carb: rice.

| Day     | Rice   | Total                       |
| ------- | ------ | --------------------------- |
| Rest    | 121 g  | P47 C44 F17 · 519 kcal      |
| Easy    | 143 g  | P47 C50 F18 · 546 kcal      |
| Quality | 200 g  | P49 C66 F18 · 617 kcal      |
| Long    | 246 g  | P50 C79 F18 · 676 kcal      |

### L2 - Beef & potato
Anchor: 140 g lean beef mince (5%) + 200 g veg + **1½ tsp olive oil**. Carb: potato.

| Day     | Potato | Total                       |
| ------- | ------ | --------------------------- |
| Rest    | 200 g  | P44 C47 F22 · 565 kcal      |
| Easy    | 235 g  | P45 C53 F22 · 593 kcal      |
| Quality | 329 g  | P47 C69 F22 · 665 kcal      |
| Long    | 406 g  | P49 C82 F22 · 724 kcal      |

### L3 - Tuna & quinoa bowl
Anchor: 140 g canned tuna (drained) + 150 g veg + **1 tbsp olive oil**. Carb: quinoa. The no-cook-protein
option — useful on days a batch has run out.

| Day     | Quinoa | Total                       |
| ------- | ------ | --------------------------- |
| Rest    | 162 g  | P45 C44 F19 · 526 kcal      |
| Easy    | 190 g  | P46 C50 F19 · 560 kcal      |
| Quality | 267 g  | P50 C66 F21 · 650 kcal      |
| Long    | 329 g  | P52 C79 F22 · 724 kcal      |

### L4 - Turkey pasta
Anchor: 130 g turkey mince (7%) + 100 g tomato sauce + 100 g veg + **2 tsp olive oil**. Carb: pasta.

| Day     | Pasta  | Total                       |
| ------- | ------ | --------------------------- |
| Rest    | 113 g  | P45 C48 F20 · 553 kcal      |
| Easy    | 133 g  | P46 C53 F21 · 583 kcal      |
| Quality | 187 g  | P48 C70 F21 · 663 kcal      |
| Long    | 230 g  | P51 C82 F22 · 728 kcal      |

## Snacks (midafternoon feed)

Fixed — no carb scaling. **A standing midafternoon feed on every day** (revised 2026-06-22 — the adherence
anchor that pre-empts evening grazing; see `nutrition.md` § Meal Distribution). Timed ~15:30-16:30 and
**funded by a smaller breakfast, not added on top**, so the day stays on tier. Keep it protein-forward
(≥30 g) and low-fat at the easy/rest tier, where fat is the binding constraint.

The S1-S3 cards run ~320-425 kcal — fine when they fully replace breakfast calories, but **at the
easy/rest tier prefer the leaner skyr builds (S4/S5)**, which land ~220-280 kcal and clear the 30 g bolus
on less fat. Skyr is high-protein and clears 30 g whey-free; the protein-weak Greek yogurt (~5.3 g/100 g)
needs ½-1 scoop whey.

| Snack                          | Build                                                                        | Total                  |
| ------------------------------ | ---------------------------------------------------------------------------- | ---------------------- |
| S4 - Skyr & whey bowl (lean)   | 200 g skyr + **½ scoop ON whey** + 80 g berries                              | P36 C18 F2 · 220 kcal  |
| S5 - Skyr & berries (whey-free)| 300 g skyr + 80 g berries + 10 g almonds                                     | P36 C23 F6 · 283 kcal  |
| S1 - Yogurt & almonds          | 250 g Greek yogurt (2%) + **½ scoop ON whey** + 20 g almonds + 80 g berries  | P42 C20 F16 · 393 kcal |
| S2 - Yogurt & whey bowl        | 250 g Greek yogurt (2%) + **1 scoop ON whey** + 1 apple + 10 g almonds       | P48 C39 F12 · 425 kcal |
| S3 - Shake & fruit             | **1 scoop ON whey** + 1 apple + **1 tbsp almond butter**                     | P28 C27 F11 · 319 kcal |

## Dinners

Pick from these on the nights you cook. For family-meal nights, see the rule below.

### D1 - Chicken stir-fry
Anchor: 135 g chicken breast + 250 g veg + **1 tbsp olive oil**. Carb: rice.

| Day     | Rice   | Total                       |
| ------- | ------ | --------------------------- |
| Rest    | 121 g  | P50 C50 F19 · 572 kcal      |
| Easy    | 143 g  | P51 C56 F19 · 599 kcal      |
| Quality | 200 g  | P52 C72 F19 · 671 kcal      |
| Long    | 246 g  | P54 C85 F19 · 729 kcal      |

### D2 - Salmon & potato
Anchor: 135 g salmon + 250 g veg + **1½ tsp olive oil**. Carb: potato.

| Day     | Potato | Total                       |
| ------- | ------ | --------------------------- |
| Rest    | 200 g  | P43 C50 F24 · 592 kcal      |
| Easy    | 235 g  | P43 C56 F25 · 620 kcal      |
| Quality | 329 g  | P45 C72 F25 · 692 kcal      |
| Long    | 406 g  | P47 C85 F25 · 751 kcal      |

**Fresh-tuna variant:** swap the salmon for 150 g fresh tuna steak + **1 tbsp olive oil** (tuna is leaner,
so it takes more oil). Totals shift to roughly P52–57 C50–85 F23 · 618–776 kcal across the tiers — slightly
higher protein, slightly lower fat than the salmon build.

### D3 - Steak & veg
Anchor: 135 g lean steak (sirloin) + 300 g veg + **1½ tsp olive oil**. Carb: potato.

| Day     | Potato | Total                       |
| ------- | ------ | --------------------------- |
| Rest    | 200 g  | P49 C54 F19 · 584 kcal      |
| Easy    | 235 g  | P50 C60 F19 · 611 kcal      |
| Quality | 329 g  | P52 C76 F19 · 683 kcal      |
| Long    | 406 g  | P53 C88 F19 · 742 kcal      |

### D4 - Turkey meatballs
Anchor: 140 g turkey mince (7%) + 150 g tomato sauce + 100 g veg + **2 tsp olive oil**. Carb: pasta.

| Day     | Pasta  | Total                       |
| ------- | ------ | --------------------------- |
| Rest    | 113 g  | P48 C51 F21 · 591 kcal      |
| Easy    | 133 g  | P49 C57 F22 · 621 kcal      |
| Quality | 187 g  | P52 C73 F22 · 701 kcal      |
| Long    | 230 g  | P54 C86 F23 · 766 kcal      |

## Family-Meal Dinner Rule

On nights dinner is not yours to portion, do not try to force a card. Anchor on:

- **Protein:** a palm to one-and-a-half palms of the meat or fish (~40 g cooked protein).
- **Carb:** match the day type — Rest = a half cupped hand of cooked starch, Easy = one, Quality = one and
  a half, Long = two.
- **Vegetables:** freely.
- **Added oils, sauces, fried sides:** keep light.

Do not log it. Hit the protein anchor, match the carb to the day, and let the weekly weigh-in absorb the
imprecision.

## Sample Days

One worked combination per day type, to show the rotation lands on target.

| Day type | Meals                                                          | Total (as built)           | Corrected target |
| -------- | -------------------------------------------------------------- | -------------------------- | ---------------- |
| Rest     | Breakfast shake + L2 + **S4** + D2                             | P171 C135 F62 · 1,775 kcal | 1,750            |
| Easy     | Small eggs breakfast + L1(↑quality carb) + **S4** + D1(↑quality carb) | P170 C176 F57 · 1,875 kcal | 1,950            |
| Quality  | B1 + Post-session shake + L1 + **S4** + D4 (apply carb shave)  | ~P219 C235 F66 · 2,200 kcal | 2,200            |
| Long     | B2 + Post-session shake + L1 + **S4** + D3 (apply carb shave)  | ~P225 C275 F62 · 2,400 kcal | 2,400            |

The easy/rest rows now carry the **midafternoon snack** as a base feed: the small breakfast funds it, and
lunch/dinner shift up a carb tier so the day still lands on target (the snack does not push it over). The
quality/long rows add the snack as a 5th feed — protein then runs high, which is protective, not a problem,
but **carbs must be protected**, so apply the carb shave to the breakfast/shake, never to the peri-workout
meals.

Each "as built" combination lands ~150-250 kcal above the corrected target before the shave — drop the oats
from the post-session shake, or take rice/potato one tier down, to close the gap. Protein and fat stay put;
only carbs come off. The 7-day weight trend governs from there.

Across every possible meal combination the rotation lands each day type within roughly ±100 kcal of its
target, with most combinations inside ±60. The 7-day weight trend governs from there.

## What to Watch

The rotation is built to be eaten without arithmetic, but two numbers still deserve a glance:

- **Protein floor (165 g).** Across all combinations the rotation lands protein 163–198 g. The leanest
  combinations sit 1–2 g under the floor — close enough to ignore most days, but if a day's meals look
  protein-light, one extra whey scoop closes the gap.
- **Fat floor (60 g).** The rotation lands fat 57–77 g. The leanest combinations land ~3 g under. If a day
  is clearly fat-light, add 10–15 g of nuts or a teaspoon of olive oil.

Carbohydrate intentionally lands a little below the nominal `nutrition.md` figures, because real food
carries protein and fat above the bare minimums and calories are held to target. This is expected. What
matters is met: calories on target, protein at floor, and carbohydrate still clearly cycled across day
types (Rest < Easy < Quality < Long).

## Other Phases

The cards are anchored to Phase 4 (Cut Block 1). For other phases, shift the carb portion only:

- **Re-entry / maintenance (~2,400 avg):** eat one carb tier up from the day type (a Rest day uses Easy
  portions, an Easy day uses Quality portions, and so on).
- **Cut Block 2 (~2,000 avg):** trim each carb portion by roughly 10%. (Phase 4's corrected target is also ~2,000 avg — the same ~10% carb trim applies now; see the correction note at the top of the file.)
- **Reverse / peak (Phase 6):** carb portions rise week by week — follow `/plan`, which carries the phase
  calorie target.

When in doubt, `/plan` states the day's calorie target; adjust the carb portion to close the gap, or ask.

## Batch Prep

Cooking three times a week, each batch covers about two days. A workable rhythm:

- Each cook: prepare 2–3 proteins and 1–2 grains in bulk, portion into containers to the card weights.
- Keep canned tuna, eggs, Greek yogurt, oats, and frozen berries always stocked — these cover the
  no-cook meals (L3, B2, B4, snacks) and bridge any gap between batches.
- Vegetables: roast or steam a large tray per cook; they reheat fine and the cards treat veg loosely.
