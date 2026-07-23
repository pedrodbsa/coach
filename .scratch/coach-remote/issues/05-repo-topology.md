# 05 — Repo topology and write model

Type: grilling
Status: resolved

## Question

Three clients, one body of coaching data. Where does the canonical working copy live, who
commits, and how does the terminal client avoid diverging from the server's copy?

The directory-ownership answer taken earlier in charting died the moment the terminal became a
first-class client rather than a build surface. Open again:

- Does the terminal client talk to the coach over the network — the same API the other two
  clients use — or does it work directly on a local clone, as Claude Code does today?
- If it is a local clone, what reconciles it with the server's copy, and when?
- What happens to uncommitted desk work? The working tree currently carries roughly fifteen
  modified files and a pile of untracked skill directories. That is the normal state here, and
  it is the failure mode to design against, not an anomaly to wish away.
- Is there a git remote at all? None is configured today. If the "redeploy anywhere and
  everything is there" guarantee is wanted, one is required.
- Does the server pull before it commits, so that changes made from the terminal reach the
  brain the server executes?

## Context

- Standing decision 4 on the map: one action core, three clients, differing in affordance
  rather than capability.
- The original spec's mitigation was "single-writer assumption keeps this simple; document
  it", which names the assumption without making it true.
- Related: [07 — Remote and secrets prerequisites](07-remote-and-secrets.md) does the work
  that a remote implies, once this ticket decides whether one is needed.

## Answer

Resolved 2026-07-23.

### There are not three writers — there are three clients of one writer

The repo conflates two things with opposite authority:

| | Code / logic | Coaching content |
| --- | --- | --- |
| What | the relay, the `coach` CLI, plugin **implementations**, workflows, **default** policy | a person's policy **overrides**, profile, state, history, logbook, store |
| Written by | the **terminal** (builder), deployed | the **server**, via the CLI and workflows |
| Lifecycle | occasional versioned releases | continuous, per-change |
| Authority flows | terminal → server (deploy) | server owns it |

The divergence bug came from trying to make one authoritative copy serve both. The resolution:
**the CLI on the server is the only writer of coaching content.** The terminal, *as a coach*,
is a network client exactly like Telegram and the web app — it drives the server, it does not
hand-edit files. The terminal's "raw control" is over **building the app**, not over bypassing
coaching governance. That is what makes the current 72 uncommitted files a symptom rather than a
constraint: they are hand-edited content, which stops existing under this model (protocol edits
become gated `decide` operations; command/skill files become app code).

### One repo, live data isolated under `data/<profile>/`

Chosen over two repos for v1 simplicity — one clone, one remote, one backup. The per-profile
folder still draws the boundary, so a later split into separate data repos is cheap if
multi-person reuse demands it.

- **Shared logic** — everything outside `data/` — is terminal-authoritative, versioned and
  deployed. The relay, the CLI, plugin implementations, workflow definitions, and each plugin's
  **default** policy.
- **`data/<profile>/`** — one subfolder per person (`data/pedro/`, `data/<partner>/`) — is
  server-authoritative, written only by the CLI and workflows, committed per-change. Holds that
  person's policy **overrides**, profile, state, history, logbook and store.

Write authority is **path-disjoint within the one repo**: the server writes only under
`data/<profile>/`, the terminal writes only logic paths, so their commits cannot conflict. This
is decision 12 made concrete: a second person is a second `data/<profile>/` and a second
container, against the same repo.

> Greenfield: this is a **new** repo, so `data/<profile>/` is created clean — there is no
> abandoned `data/` to collide with (that lives only in the old repo, which is a content source,
> not the target). Each profile folder holds that profile's own DuckDB (decision 34), so
> physical DB isolation is the profile-folder boundary.

### Defaults versus overrides is the seam

A plugin ships default policy in the **shared logic** (builder-authored). A person's steering
lives as an **override layer** under `data/<profile>/` (`decide`-mutable, gated).
Effective policy = defaults + overrides. Authoring and steering never touch the same file, so
the two writers stay disjoint. Plugin *authoring from scratch* (a new cycling plugin) is a
builder/deploy act; plugin policy *steering* (adjusting a tier) is a `decide` act. Different
files, different authorities.

### The ticket's sub-questions, answered

- **Terminal: network or local clone?** Both hats. As **builder** it works on a local clone and
  deploys. As **coach** it is a network client to the server's CLI (which is where the store and
  the live Garmin sync are); it does not run coaching operations against a local content clone.
- **What reconciles the terminal with the server's copy?** For coaching content, nothing — the
  server is the sole writer, the terminal never writes under `data/<profile>/`, so there is
  nothing to reconcile. For logic, ordinary git: the terminal pushes, the server pulls to
  redeploy.
- **Uncommitted desk work?** Logic work in progress is normal dev flow. Coaching content is
  never hand-edited, so the "uncommitted content" failure mode is gone by construction.
- **Is there a git remote?** One repo, one remote — still none configured. Prerequisite for
  [07](07-remote-and-secrets.md).
- **Does the server pull before it commits?** The server pulls logic changes to redeploy and
  writes only under `data/<profile>/`; the terminal writes only logic paths and pulls
  `data/<profile>/` read-only. Disjoint paths, so a rebase is clean.

### Consequences

- **[07](07-remote-and-secrets.md)** provisions one private repo with one push credential; the
  container commits `data/<profile>/` changes back to it.
- The new repo is built to this layout from the start; the old repo's protocols and logbook are
  **ported** into it — default policy → shared logic; profile, state, history, logbook, store
  and overrides → `data/pedro/`. Nothing is edited in place. The *shape* of that port (how the
  existing documents split into the four kinds) is [12](12-command-doc-rewrite.md) /
  [13](13-policy-state-split.md); this ticket sets the target layout.
- Keeps decision 12 cheap: a second person is a second `data/<profile>/` plus a container, and
  the drawn boundary makes a later two-repo split low-cost if reuse grows.
