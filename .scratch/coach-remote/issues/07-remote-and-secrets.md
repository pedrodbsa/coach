# 07 — Remote and secrets prerequisites

Type: task
Status: open

## Work

Manual work that unblocks later decisions. Nothing here is a judgement call; it is the
groundwork that has to exist before deployment questions can be answered concretely.

1. **Get the Garmin password out of the committed `.mcp.json`.** It is in the repo today. The
   moment a remote exists this is a leak, and the original spec already flagged it as
   prerequisite zero. Move it to an environment variable or a secret and confirm the MCP still
   authenticates.
2. **Decide and, if needed, create the git remote.** No remote is configured. If
   [05 — Repo topology](05-repo-topology.md) concludes one is required, create the private
   repository and provision the push credential (deploy key or fine-scoped token).
3. **Telegram bot registration**: create the bot, record the token, the webhook secret token,
   and the allowlisted `chat_id`. (No standalone-PWA shared token — [06](06-webapp-access-route.md)
   replaced it with Tailscale; provision tailnet access for the web app instead.)
4. **Confirm the Dokploy host** is available and note how secrets are supplied to a container
   there.
5. **Garmin login for `garmin-cli`** — a **terminal** email/password prompt with terminal MFA,
   not the browser SSO the spec describes (corrected by ticket 04). Done once; `sync` refreshes
   its own OAuth2 thereafter with no password, and the `keyring` dependency is optional so a
   headless container works. Record where the token JSON lives (mode 0600, on the volume).
6. **Pin versions.** `garmin-cli`'s release workflow uses an unpinned `ubuntu-latest`, so the
   published binary's glibc floor can rise silently and break a Debian base image with no
   changelog entry. Pin the `garmin-cli` version and the container base image together, and
   note the pair so an upgrade is a deliberate act.

## Answer should record

What was done, where each credential now lives, and any resulting facts later tickets depend
on — the remote URL, the bot username, the host address.

## Context

- Item 1 is worth doing regardless of what the rest of this map concludes.
- Items 2 and 3 wait on [05](05-repo-topology.md) and
  [09 — Client affordance matrix](09-client-affordance-matrix.md) respectively; do item 1
  first and the others when their decisions land.
