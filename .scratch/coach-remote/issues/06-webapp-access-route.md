# 06 — Web app access route

Type: grilling
Status: resolved

## Question

One decision, with two mutually exclusive answers.

**Tailscale** keeps the web app off the public internet and needs no auth build at all. But a
tailnet requires a client installed on the machine you are using, so it cannot serve the case
that motivated the web app in the first place: *"if I'm at someone else's computer I won't be
able to access it."*

**Public HTTPS with a session login** serves that case, at the cost of a small auth build and
a permanently public surface — which is also where the Telegram webhook has to live anyway.

So: which requirement is real? If borrowed-computer access matters, Tailscale does not deliver
it. If it does not, the auth ticket disappears entirely.

Decide the access route and the minimum auth that goes with it. If public, decide the
mechanism — a password with a session cookie, a passkey, or something else — and note that the
original spec's answer, a single long-lived shared token, is the one option that is clearly
wrong for a borrowed machine.

## Context

- The user's stated position while charting: "no need for fancy webapp auth for now. if
  needed I can even setup a tailscale and secure my access using it."
- The earlier stated requirement, from the same conversation: access from someone else's
  computer without a terminal.
- Telegram's webhook needs an inbound public route regardless, so "nothing is public" is not
  achievable while the Telegram client exists.

## Answer

Resolved 2026-07-23.

**Tailscale for the web app; the borrowed-computer case is served by Telegram, not by the web
app.**

### Two surfaces, cleanly separated

- **Telegram bot** — the only public surface. An inbound webhook protected by the
  `X-Telegram-Bot-Api-Secret-Token` header and a hard `chat_id` allowlist (per person, in the
  multi-profile future). Carries **chat, inline buttons, and push** — summaries and bounded
  interactions only. Reachable anywhere, including a borrowed computer via Telegram Web, with no
  client install.
- **Web app** — **Tailscale-only.** All dense and sensitive views (weight, body composition,
  skin, medication, the strength tables) and all `decide` policy steering. Reachable only on
  tailnet devices. Tailscale *is* the auth, so there is no auth build.

### The borrowed-computer requirement is met, not dropped

The earlier requirement — "if I'm at someone else's computer" — is served by **Telegram chat**,
which runs in any browser. What a borrowed computer does *not* get is the rich web app. That is
deliberate: the sensitive surface should require a trusted device, and "only on my tailnet" is a
stronger boundary than a shared token on a public URL.

### The sensitivity policy becomes structural

Earlier framing had sensitive detail rendering in a Mini App "served from the athlete's own
domain, never transiting Telegram's servers" — a rule the implementation had to enforce
per-message. Under this split it is enforced **by construction**: sensitive detail physically
lives only on the tailnet web app, so Telegram cannot render it because that surface is not the
web app. Nothing to police per message.

### Derived, not asked: the Telegram Mini App drops from v1

Flagged for confirmation in [09](09-client-affordance-matrix.md). The Mini App is the one thing
that would force the rich surface to be publicly reachable — Telegram loads it in a webview, and
whether a tailnet-only URL is acceptable there is an implementation gamble. Dropping it makes
the split unambiguous: Telegram is chat-and-buttons, the web app is the rich tailnet surface.
The cost is losing rich forms embedded in the chat thread; the main case was the `/week`
calendar, and `/week` is out of scope. Reconsider in v2 only if embedding rich forms in Telegram
proves worth a public rich surface.

### Consequences

- **Corrects the spec**, which served the PWA "both as a Telegram Mini App and as a standalone
  installable PWA at the same URL … one bundle, two entry points" behind a shared token on
  public HTTPS. That whole model is replaced: public Telegram bot (no Mini App) + Tailscale-only
  web app.
- **Multi-profile:** each person's container joins the tailnet; a household tailnet gives each
  person their web app and their own bot (`chat_id` allowlist per person). No per-person auth
  build.
- **Removes the standalone-PWA shared token** from the secrets list in
  [07](07-remote-and-secrets.md) — Tailscale replaces it.
- Feeds [09](09-client-affordance-matrix.md): Telegram = chat + inline buttons (no embedded
  rich forms); web app = the full rich surface, tailnet-gated.
