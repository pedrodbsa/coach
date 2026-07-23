# 09 — Client affordance matrix

Type: grilling
Status: resolved
Blocked by: 01

> **Inputs from resolved tickets (2026-07-23):** [06](06-webapp-access-route.md) split the
> surfaces — Telegram is public chat + inline buttons only; the rich web app is Tailscale-only.
> The **Telegram Mini App was dropped from v1** as a derived consequence; **confirm that here**,
> since it removes "embedded rich forms in the chat" from the matrix.
>
> **Corrected 2026-07-23 (ticket 11):** the Telegram/web split is by **affordance, not
> sensitivity**. The athlete does not mind his own health data in his private chat, so there is
> **no per-field secrecy rule** to encode. What lives only in the web app does so because it
> needs dense rendering (tables, trends, history). The hard boundary the matrix must enforce is
> **profile isolation** — never show one profile's data on another's surface (containers +
> `chat_id`, decision 12), not "keep weight out of chat".

## Question

For each action, on each client, what does the interaction actually look like?

The three clients differ in affordance, not capability:

| Client | Strengths | Limits |
| --- | --- | --- |
| Telegram | Chat, widgets, realtime notifications, always in your pocket | Bounded UI, no dense data, content rests unencrypted on a third party |
| Web app | Guardrailed controls, richer and denser rendering, full coach | No push, needs a browser and a network route |
| Terminal | Raw, full control, builder | Tied to a machine with a checkout and a terminal |

Produce the matrix: per action and per client, which steps are buttons, which are forms, which
are free text, and which are read-only renders. Then answer the awkward cases:

- Where a client cannot express an action's gate or an input it needs, does the action
  **degrade** there, or is it simply **unavailable** on that client? Say which per action
  rather than as a blanket rule.
- Which surface renders a gate opened by another surface — you draft on the web app and
  approve from Telegram an hour later.
- Does the sensitivity boundary survive? The original spec ruled that detailed data — weight
  and body composition, skin history, medication — renders only in the Mini App and never
  transits Telegram. Decide whether that rule holds under the new split, and how it is
  enforced in code rather than judged per message.

The output should be concrete enough that the Telegram work and the web app work can both be
specced from it without further negotiation.

## Answer

Resolved 2026-07-23. Composition of the settled surfaces (37, 40), the action catalogue (01),
gates (41), and the n8n driver (44) — no new fork.

### Routing

- **Telegram** → n8n Telegram node → workflow → `coach` CLI.
- **Web app** → n8n HTTP API → workflow → `coach` CLI.
- **Terminal** → `coach` CLI **directly** (bypasses n8n). A useful property: the terminal works
  even if n8n is down — it is the engine's escape hatch.

### The matrix

`btn` = inline button/tap · `text` = free text · `form` = web form · `read` = render only ·
`—` = not offered here.

| Action | Telegram | Web app | Terminal |
| --- | --- | --- | --- |
| **plan** (view + approve) | push summary + `btn` Approve/Adjust; DSW question `btn`/`text` | dense Today view; `btn` Approve/Adjust; DSW `form` | `coach run plan …`; approve inline |
| **garmin.push** | auto on Approve (chained); manual `btn` | auto on Approve; manual `btn` | `coach garmin push …` (auto-chains) |
| **meal.confirm** | `btn` per meal | tap the meal card | `coach nutrition confirm <meal>` |
| **meal.log** (changed) | `text` | `text` / structured edit + re-tune `read` | `coach …` / session |
| **session.log** | `text`, or auto from Garmin sync | `text` + rich session `read` | `coach …` |
| **adjust.day** | `text`; diff `read`; `btn` Undo | `text`/controls; diff `read`; `btn` Undo | `coach …` |
| **skin.capture** | `text` (verbatim) | `text` + skin-log `read` | `coach skin capture …` |
| **decide** (policy/profile) | **—** unavailable | propose → diff `read` → `btn` Approve | `coach …` / session |

### Degrade vs unavailable

- **Only `decide` is unavailable on Telegram** — the deliberate "no policy edits from Telegram"
  boundary (decisions 5, 29). A proposal may *notify* Telegram, but it resolves in the web app
  or terminal.
- **Everything else works on every client.** What degrades on Telegram is *rendering*, not the
  action: a dense plan becomes a summary, a trend becomes "see the web app", but the approve, the
  log, the adjust all function. History and trends are web-only **views** (decision 40), not
  actions, so they do not appear here.

### Gates across surfaces — two execution modes

The gate is one *concept* ("pause for a human decision", decision 01); its *implementation*
depends on who is driving:

- **Remote (n8n-driven):** an n8n **Wait node** — async and durable. Opened by the morning cron,
  delivered to Telegram as a push with buttons; the button callback, or a web-app form, or a
  thin `coach resume <token> <answer>` from the terminal, **all POST the same resume webhook**.
  So a gate opened on one surface resolves from any other, an hour later, natively (decision 41).
- **Terminal-direct:** synchronous — you are sitting there, so `coach run plan` presents and the
  session confirms in-line. No Wait node needed.

The CLI stays the one interface either way: it returns a structured "awaiting-decision" result;
n8n turns that into a Wait, the interactive terminal turns it into a prompt.

### Sensitivity → affordance + profile isolation (confirmed)

Per decision 37 (revised via ticket 11): **there is no per-field secrecy rule.** Telegram may
carry the athlete's own numbers freely; his chat is private to him. What lives only in the web
app does so because it needs **dense rendering** (trends, body-comp history, the skin log), not
because it is secret. The one hard, code-enforced boundary is **profile isolation**: a profile's
surfaces show only that profile's data — per-profile bot `chat_id` and the core scoping every
op to `data/<profile>/` (decisions 12, 34). Cross-profile bleed is the failure to prevent.

### Mini App — confirmed dropped

The derived drop (decision 37) is confirmed: **Telegram is chat + inline buttons only.** No
embedded rich forms in the chat; forms live in the web app. This removes "embedded rich forms"
from the matrix entirely.

### Feeds

Concrete enough to spec both the n8n Telegram workflows and the web-app views. The `decide`
notification-to-Telegram-but-resolve-elsewhere pattern is the one cross-surface subtlety the
Telegram work must handle.
