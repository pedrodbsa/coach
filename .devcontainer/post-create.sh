#!/usr/bin/env bash
set -euo pipefail

# node_modules is a fresh, root-owned named volume on first create — hand it to node.
if [ -d node_modules ]; then
  sudo chown node:node node_modules
fi

# Chunk 1 has not created the TypeScript project yet, so a manifest may not exist.
# Install only once it does; stay quiet (and green) before then.
if [ -f package-lock.json ]; then
  npm ci
elif [ -f package.json ]; then
  npm install
else
  echo "no package.json yet (pre-Chunk 1) — skipping npm install"
fi

# Pre-provision the Python the Garmin MCP runs under (matches .mcp.json's `uvx --python 3.12`).
uv python install 3.12

# Sanity-check the pinned Garmin binary is on PATH.
garmin --version || echo "garmin present, but 'version' output differs — try 'garmin --help'"

cat <<'EOF'

  Remote Coach devcontainer ready.

  One-time auth (run in the integrated terminal, inside the container):
    claude                 # sign in to Claude Code (browser flow)
    codex                  # sign in to Codex (Sign in with ChatGPT)

  Auto-approve modes (workspace is the blast-radius boundary):
    claude --dangerously-skip-permissions
    codex --full-auto

  Garmin (only needed from Chunk 4 onward):
    printf '%s' 'you@example.com' > secrets/garmin_email
    printf '%s' 'app-password'    > secrets/garmin_password
    # then the MCP reads them via GARMIN_EMAIL_FILE / GARMIN_PASSWORD_FILE.
    # garmin-cli login flow (browser-SSO vs terminal-MFA) is confirmed when Garmin is wired.

  Reminder: egress is open and these secrets live in the box — see the security note.

EOF
