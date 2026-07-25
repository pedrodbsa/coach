# syntax=docker/dockerfile:1

# Native Unix home for the Remote Coach stack + an isolation boundary for auto-approved
# coding agents. The base image is pinned together with GARMIN_CLI_VERSION, per the plan's
# Global Constraints invariant ("pin the garmin-cli version and the container base image together").
# Debian 13 (trixie), glibc 2.41 — garmin-cli's release binary needs glibc >= 2.38,
# which Debian 12 (bookworm, glibc 2.36) does not provide.
FROM mcr.microsoft.com/devcontainers/typescript-node:22-trixie

# --- version pins (bump the base image tag and GARMIN_CLI_VERSION as a pair) ---
ARG GARMIN_CLI_VERSION=v2.1.0
ARG GARMIN_SHA256_AMD64=b83390f6669fde0d0e00ff6e123818a3837ea826fc88f2bed6fcce807b76a592
ARG GARMIN_SHA256_ARM64=6eec6e6948011869978c958a817bb601757a48bd00b7e21a15951829ac2875b2
ARG UV_VERSION=0.11.31
ARG CODEX_VERSION=0.145.0

# Provided by BuildKit: "amd64" or "arm64".
ARG TARGETARCH

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# uv — runs the Python Garmin MCP on demand via `uvx` (the write half of the Garmin split).
RUN curl -LsSf "https://astral.sh/uv/${UV_VERSION}/install.sh" | env UV_INSTALL_DIR=/usr/local/bin sh

# garmin-cli — Rust binary, the read half of the Garmin split (-> per-profile DuckDB/Parquet).
# Prebuilt, checksum-verified release; no Rust toolchain in the image.
RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) sha="${GARMIN_SHA256_AMD64}";; \
      arm64) sha="${GARMIN_SHA256_ARM64}";; \
      *) echo "unsupported arch: ${TARGETARCH}" >&2; exit 1;; \
    esac; \
    asset="garmin-linux-${TARGETARCH}.tar.gz"; \
    curl -fsSL -o /tmp/garmin.tgz \
      "https://github.com/vicentereig/garmin-cli/releases/download/${GARMIN_CLI_VERSION}/${asset}"; \
    echo "${sha}  /tmp/garmin.tgz" | sha256sum -c -; \
    tar -xzf /tmp/garmin.tgz -C /tmp; \
    install -m 0755 "/tmp/garmin-linux-${TARGETARCH}" /usr/local/bin/garmin; \
    rm -rf /tmp/garmin.tgz "/tmp/garmin-linux-${TARGETARCH}"; \
    garmin --version || true

# Codex CLI. Claude Code is installed natively in post-create.sh (not via a devcontainer
# feature — see the note there), so it lands in ~/.local owned by node and can self-update.
RUN npm install -g @openai/codex@${CODEX_VERSION}

# Agent + MCP state dirs. Each is backed by a named volume at runtime so auth survives rebuilds.
RUN mkdir -p /home/node/.claude /home/node/.codex /home/node/.garminconnect \
 && chown -R node:node /home/node/.claude /home/node/.codex /home/node/.garminconnect
