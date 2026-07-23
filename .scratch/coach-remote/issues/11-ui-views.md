# 11 — What the UI shows

Type: prototype
Status: resolved
Blocked by: 02

## Question

Prototype the web app's views from the structured plan schema.

At minimum:

- A **home / today** view that answers "what is my workout" and "what is my meal plan" at a
  glance, with no scrolling past reasoning to reach them.
- A **day** view carrying prescribed against actual.
- A **history** browser over past days.

Then the questions the prototype exists to answer:

- What is data-dense enough to justify the web app over Telegram? If a view renders fine as a
  Telegram message, it is not making the case for a browser.
- What does the **Telegram** render of the same content look like, given the same underlying
  data? The two clients should not diverge into two different truths.
- Where do the guardrailed controls sit — what can be changed by tapping rather than by
  chatting, and what must stay conversational?

## Context

- Standing decision 7: the web app is the coach, not a companion.
- Standing decision 8: the athlete should never have to read the agent's reasoning to find out
  what today's workout is.
- Charts, trends and dashboards are out of scope for this map.

## Answer

Resolved 2026-07-23. Prototype: `../prototypes/ui-today.html`, published as an artifact and
kept as the primary source. It renders the 22 July day for the web app and Telegram side by
side.

### What the mockup validated

- **Glance-first holds.** Two answer-cards — the session, the food — carry numbers not prose,
  and the head coach's reasoning is a collapsed "Why this shape?" disclosure. Decisions 8 and 23
  made visible.
- **State encoded as form.** Macro bars in semantic colour (floor cleared / trimmed-by-design)
  read the day's status without reading the totals.
- **The web-vs-Telegram contrast is the design's whole point.** Telegram gets the decision as a
  short message plus approve/adjust buttons; the web app gets the dense version.

### What the athlete's reaction changed

1. **The Today view is denser than the mockup.** The athlete wants *more* on the first screen,
   not less — readiness markers (HRV, sleep, body battery), trailing load and week context
   surfaced alongside the session and food. Density is the web app's reason to exist. Map
   decision 38. The mockup under-built this; a v2 of the mockup would add a markers strip and a
   load line above the answer-cards.
2. **The Telegram/web split is by affordance, not sensitivity.** The athlete rejected the
   privacy-from-Telegram premise — his chat is private to him and his own health data in it is
   fine. So there is **no per-field secrecy rule**; what lives only in the web app does so
   because it needs dense rendering. The real boundary is **profile isolation** (no cross-profile
   bleed). Map decision 37 revised; the mockup's "lock line" was corrected accordingly.
3. **History is trends-first, bounded.** The athlete wants history to lead with the quantitative
   arc (weight, load, adherence) and drill into days — which is the v2 dashboard shape. Resolved
   as a **scope decision**: v1 ships **minimal trends** the store already holds (morning-weight
   trend, weekly load, adherence) as simple charts, with day drill-down beneath; the elaborate
   interactive/correlation dashboard stays v2. Map decision 39. This moves the documented "no
   charts in v1" non-goal — deliberately, and bounded to cheap-on-the-existing-store arcs.

### The three views, settled

- **Today** — the data-dense instrument panel above. Answer-cards + markers/load strip +
  reasoning behind a tap.
- **Day** — prescribed against actual, per the plan schema's `actual` fields ([02](02-plan-schema.md)).
- **History** — trends-first (minimal, v1), days beneath.

### Refined same day — the web app is a sectioned backoffice

The athlete then scoped the clients further: Telegram is for **today's plan and a few skills**,
never historical data; the web app is the **control center / backoffice**, richer, with
sections. The section IA falls out of the four kinds (decision 16):

| Section | Surfaces | Kind |
| --- | --- | --- |
| **Today** | the instrument-panel plan | plan / state |
| **History** | trends-first + day drill-down | state / history |
| **Protocols** | read policy + `decide` steering | policy |
| **Profile** | goals, races, HR zones, equipment | profile |

The clean mapping onto the four kinds is a coherence check on the whole model. Map decision 40.
The `ui-today.html` mockup covers only the Today section; a fuller backoffice shell (nav +
the History and Protocols sections) is a worthwhile follow-up mockup but not required to settle
the decision.

### Guardrailed controls (the ticket's third question)

From the mockup: the **approve/adjust** gate is buttons on both surfaces; **logging** is a tap
(`meal.confirm`) or free text (`meal.log`/`session.log`); **`decide` steering** is web-app-only
(tailnet). What stays conversational is anything open-ended — adjustments, questions. What
becomes a control is anything bounded — approve, confirm, a severity pick. This is the raw
material for [09](09-client-affordance-matrix.md), which owns the full matrix.
