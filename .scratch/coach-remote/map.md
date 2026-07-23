# Map: Remote Coach — v1 spec

Labels: `wayfinder:map`
Started: 2026-07-22

## Destination — REACHED (2026-07-23)

A **decision-complete v1 spec** for the remote coach. **Written:**
`docs/superpowers/specs/2026-07-23-remote-coach-v1-design.md`, synthesised from the 50 decisions
below; the 2026-06-19 spec is marked superseded. All 16 design tickets resolved; only ticket 07
(the athlete's build-prerequisites task) remains open. The way from here to the destination is
clear — the map is complete.

## Notes

### Domain

A personal coaching system for a single athlete. The system has three interrelated domains,
each needing a different level of agent intelligence:

| Domain | Intelligence | What lives there |
| --- | --- | --- |
| **Actions** | Mixed — orchestration plus judgement steps | `/plan`, `/log`, `/garmin`, `/body`, `/skin`; their step lists, gates and outputs |
| **Context / data** | Mostly mechanical | The structured plan, the prose journal, the DuckDB store, the briefs, the `coach` CLI |
| **Protocols** | Highest — policy, changed rarely | `protocols/*.md`: thresholds, tier tables, decision trees |

The three affect each other constantly, which is why the boundaries between them are the
subject of most of the tickets below.

### Skills to consult

`grilling` and `domain-modeling` by default. `prototype` for the schema and UI tickets;
`research` for the research tickets.

### Standing preferences for this effort

- Criticism and push-back are wanted. Say when something is wrong, not merely when it is risky.
- The athlete is time-constrained. Prefer the smaller build that meets the vision over the
  complete one that does not ship.
- Do not launch subagents unless asked, including for research tickets.
- No issue tracker and no git remote are configured, so this map uses the local-markdown
  tracker under `.scratch/`.
- **Greenfield build in a new repo (2026-07-23).** The destination is a spec for a **new**
  system in a **new** repo. This repo (`X:\pedrodbsa\routine`) is only a **content source** —
  its protocols and logbook will be ported into the new structure. Nothing about this repo's
  layout, its abandoned trees, or its uncommitted state is a constraint on the design; it is
  reference for the domain, not a migration target. Wherever a ticket says "migrate" or
  "clean up this repo", read "port the content into the new structure".

### Settled while charting (2026-07-22)

Standing constraints for every session on this map. These predate the tickets and are not
themselves tickets.

1. **Destination is a spec**, not a build. Wayfinder's plan-only default holds.
2. **v1 scope is the remote surface plus the brief/data layer.** The `/week` redesign was
   separated out as its own effort.
3. **The brief is two-phase.** Markers and history are pre-computed before the agent turn;
   anything downstream of a decision the agent has not yet made — day type, calorie tier,
   strength slice — is a callable lookup instead of a pre-filled field.
4. **One action core, three clients.** Telegram (chat, widgets, realtime push), web app
   (guardrailed controls, richer and denser UI), terminal/Claude Code (raw, full control,
   builder). Every action is callable from all three; the clients differ in affordance, not
   in capability.
5. **Protocols are not edited from Telegram.** Protocol changes are rare and belong in the
   web app or the terminal.
6. **`/plan` is triggered manually**, never by clock, because it depends on the morning
   weigh-in having landed first.
7. **The web app is the coach, not a companion.** Full access from any browser. Telegram
   exists for push and on-the-run convenience. The two may converge into one client later.
8. **The daily artifact splits in two.** A structured plan file the UI renders as data, and a
   prose journal the agent uses. The athlete should never have to read the agent's reasoning
   to find out what today's workout is.
9. **Actions are primitives; workflows compose them.** An action is a unit of work, either
   deterministic or agent-driven. A workflow is an ordered composition of actions, gates and
   chains. What was called `/plan` is a workflow, not an action. Gates are durable pause
   states rather than live sessions, in two flavours — `needs-input` and `needs-approval`.
   *(Revised 2026-07-22 while resolving ticket 01; originally "an action is an ordered list
   of steps".)*
10. **Mechanical work goes through an internal `coach` CLI/SDK.** The agent's tool surface is
    file tools, `coach …`, and the Garmin MCP for workout writes. Deterministic work stops
    being something the agent improvises.
11. **Modules are a real boundary.** A module bundles four things that are scattered today:
    its policy documents, the actions it contributes, the brief fields it needs, and the state
    it owns — roughly `running`, `strength`, `nutrition`, `skin`, `mobility`, `supplements`.
    Workflows are declared as compositions over module-contributed actions, so dropping a
    module drops its steps. The argument for this is not a second user; it is that modules
    force the policy/state/action boundaries decision 6 and ticket 01 already committed to.
    **Modules partition ownership, not context** — the agent's decide step reads the union of
    every active module's policy, because running affects strength affects nutrition. A module
    boundary governs composition and configuration, never what the agent may see.
12. **Profiles share one n8n instance; data is isolated per profile.** *(Revised 2026-07-23 per
    decision 44 — was "one profile per deployment, a second person is a second container".)* One
    shared n8n instance hosts each profile's own workflow set (per-profile JSON in git). A
    profile selects modules, points at its own policy documents, and owns its state and its own
    DuckDB (decision 34), all under `data/<profile>/` (decision 36). Isolation is now
    **software-enforced**, not container-enforced: every core operation takes a profile and
    scopes strictly to that profile's `data/<profile>/`, and **must never cross** — a hard
    invariant, because the shared n8n process is a softer boundary than separate containers were.
    Data-at-rest separation still holds (one DB per profile). If OS-level isolation is later
    wanted, n8n can run per profile — heavier, not needed now.
13. **The agent's output is a structured result, not a token stream.** What is wanted from a
    workflow is *what to do*, plus optionally *why the coach decided it* — not a view of the
    agent working. Workflow actions therefore return structured results the clients render;
    streaming chat matters only in free conversation. This makes the plan schema the agent's
    output contract, not merely a storage format, and it is why a request/response
    orchestrator remains viable.
14. **Workflows are composed once, not per run.** Composition happens at setup or when the
    profile's modules change; the result is a materialised graph. Dynamism inside a run comes
    from reasoning steps that return a branch key, not from recomputing the composition.
15. **Third-party ingestion tools are replaceable optimisation layers, never dependencies.**
    `garmin-cli` earns its place because the Parquet store is committed to git and DuckDB reads
    it directly — the **data** depends on nothing, only **ingestion** does, and the MCP
    fallback is already required for indoor per-sample analysis so it stays exercised. A stall
    costs token-heavy N-call aggregation and offline resilience, not capability. Any future
    third-party tool must clear the same bar: if it vanished tomorrow, what is lost must be
    performance, never data or function.
16. **Four kinds, not two: policy, profile, state, history.** Policy and profile are read-only
    to every action; state and history are what actions write. This is the enforceable form of
    decision 5 — a Telegram-invoked action may write state and history, never policy or
    profile.
17. **A head coach module owns cross-specialist interactions.** Specialists (`running`,
    `strength`, `nutrition`, `skin`, `mobility`) own their domain policy; anything spanning two
    or more belongs to the head coach, which already exists as `protocols/coaching.md`.
    Head-coach rules quantify over **vocabulary the active specialists register**, so removing
    a specialist shrinks the vocabulary rather than breaking the rule. Supersedes the flat
    module list in decision 11.
18. **Workflows are declared in a document the head coach owns** — the steps and which module
    contributes each. Editable without a redeploy, versioned in git, and sitting beside the
    philosophy that justifies it.
19. **A module is a vertical slice.** It owns its data fetch, derived context, policy and
    state, and **exposes its own API through the `coach` CLI**. `sleep` is the clarifying case:
    today it is scattered across the brief, the readiness tree, a fallback rule and the
    coaching log; as a slice it owns all of it. This is the brief properly decomposed, and it
    is what lets a caller pull one slice instead of the whole protocol stack.
20. **The head coach decides *whether* and *what*; a specialist decides *how*.** The head coach
    says "quality today" without knowing running methodology, and the running coach turns that
    into a session. So `running`, `strength`, `nutrition` and probably `mobility` have coaches;
    `sleep` and `skin` do not, because nothing about them is *prescribed* — interpretation is a
    whether/what question and stays with the head coach. This is what stops a narrow specialist
    reproducing the 2026-07-01 misattribution, where a bad night on balanced HRV was read as
    training fatigue rather than anxiety. Specialists are **not** simply parallel: `nutrition`
    runs after `running` and `strength`, because fuelling depends on the session.
21. **Model and effort are declared per workflow step, and validators make downgrading safe.**
    The head coach's holistic judgement warrants a strong model; assembling a meal to hit a
    macro target does not. Because the declaration lives in the workflow document (decision
    18), it is tunable without a deploy. Any specialist whose output is **mechanically
    checkable** gets a `coach <module> validate` command — macros hit, three protein boluses
    over 30 g, fat floor cleared, every run step carrying an HR or pace target — and a failed
    check re-runs or escalates to a stronger model. This is what turns several small calls into
    a cost *saving* rather than a cost multiplier.
22. **Do not replace a cheap specialist with a solver.** Meal assembly looks like constraint
    satisfaction, but its constraints are prose that changes — fruit after lunch, iso with the
    fattiest meal, eggs in counts not grams, the snack funded by a smaller breakfast. Encoding
    them into a solver freezes policy into code and needs a deploy to change what he eats,
    which is exactly what decision 10 protects against. Cheap model plus deterministic
    validator, not deterministic solver.
23. **A one-line `why` per element, hidden by default.** Any prescribed thing may carry a
    single sentence explaining itself, attached to the element rather than collected in a
    section; the UI shows the *what* and reveals the *why* on tap. The one-sentence cap is the
    mechanism — without it the essays regrow, which is how a daily file reached 260 lines for
    57 lines of content.
24. **The `coach` CLI is the only writer of the plan file.** Specialists return structured JSON
    as their output contract; the CLI validates and persists YAML. The agent never hand-edits
    it, so the on-disk format is chosen for the athlete and for git diffs rather than for model
    reliability.
25. **The plan document is partitioned by module**, each block owning its plan, its validators
    and its actuals, with the head coach and the brief at root alongside them. Validators live
    inside the module they check, not in a shared block.
26. **A specialist reads the head coach's decision, its own block, and its declared
    dependencies — nothing more.** The same `depends_on` that orders the specialists scopes
    what each reads, so no new mechanism is needed. This is what module-partitioning buys:
    "the sessions but not the meals" is only a slice you can take if the document is cut that
    way. The exclusion is deliberate in both directions — small contexts, and no specialist
    straying into a whether/what judgement that belongs to the head coach. The head coach reads
    everything.
27. **A day's reasoning graduates to a bounded coaching-log row; the derivation stays in the
    journal.** The long `####` essays in daily files are derivations, not artifacts — the
    artifact is the decision. Sessions load decisions, never derivations, so loaded context
    grows with the number of durable decisions (one line each), not with the number of days.
    That is the eviction mechanism: derivations are evicted from load by construction. The
    journal is agent-and-audit only, never in a default read or a loaded context.
28. **The memory layers are the four kinds, not a new system.** Global = coaching log + policy
    + profile; weekly = the state snapshot; daily = the plan document (loaded) plus the journal
    (not); the brief is the transient layer beneath. Memory is per-module: a specialist loads
    its own slice plus its declared dependencies; the head coach loads across slices.
29. **A `decide` workflow makes durable changes.** Policy, profile and coaching-log changes are
    not actions (decision 16 makes those read-only). The coach proposes with its derivation,
    the athlete approves, and the CLI atomically appends the log row and applies the edit. Web
    app and terminal only, never Telegram — decision 5 as a mechanism. This is why Jul 21's
    policy edits were all marked "athlete-agreed": consent is structural, not incidental.
30. **The head↔sub relationship is the same shape at two timescales.** Daily, the head coach
    decides *what* and sub-coaches decide *how* (decision 20). For policy, the head coach sets
    *direction*, sub-coaches propose *domain-specific policy changes*, and the head coach —
    with the athlete — reviews, requests adjustments, and mediates cohesion across domains. In
    both cases the head coach holds only the holistic and the cross-domain interactions
    (decision 17), never a domain's internals, which is what keeps its context lean. Modules
    are therefore autonomous policy-owners — each owns and evolves its own data, policy and
    state — *steered* by the head coach, not authored by it. This resolves the twice-deferred
    "where do working loads live" question: the strength coach owns its loads and progression
    rules and proposes the bumps; the head coach never sees them.
31. **Policy steering runs weekly by default, with an ad-hoc escape for the urgent case.**
    Sub-coaches propose domain-policy steering at the weekly recap, where head coach and
    athlete mediate as a considered batch. The same `decide` workflow (decision 29) stays
    invokable mid-week for the rare urgent correction — a discovered measurement artifact like
    Jul 21 must not wait for Sunday. One mechanism, two triggers. The weekly recap is
    `decide`'s primary caller and belongs to the **out-of-scope `/week` effort**; this map
    specifies the `decide` workflow, not its weekly invocation.
32. **A module is a plugin: a self-contained life area.** The plugin contract is the module
    abstraction — it owns its data, policy and state; it may have a coach; it exposes a `coach
    <domain> …` CLI namespace including a deterministic `summary`; it declares its dependencies;
    and it can petition other domains through the head coach. This is the unifying form behind
    decisions 19, 26 and 28. The bar it sets: the contract must be clean enough that a future
    plugin — cycling, household management, social life — slots in without touching the core.
    Non-quantitative domains will test the contract (a social-life plugin has no Garmin feed and
    no numeric validator), but that is future work; v1 must only avoid precluding them.
33. **Cross-domain influence is mediated, and phrased in head-coach terms.** A sub-coach may
    petition another domain through the head coach — the running coach asking that the athlete
    needs posterior-chain strength work. The petition carries a **capability or priority**, not
    domain internals: "needs posterior-chain support", never "do RDLs at 80 kg". The head coach
    mediates the priority; the target sub-coach still owns the *how*. This is what keeps the
    head coach's context lean while letting domains genuinely affect each other.
34. **One DuckDB per profile; domains logically segregated within it.** *(Revised 2026-07-23:
    physical isolation between profiles, not one shared store.)* Each **profile** has its own
    DuckDB, living inside its `data/<profile>/` folder (decision 36), so data cannot leak
    between people and each person's `garmin-cli` auth and store are their own. **Within** a
    profile, each domain owns its data namespace and reads only its own; the Garmin raw tables
    sit at integration level beneath the domains, which project from them. The head coach never
    queries raw domain data — it reads a **deterministic per-domain `summary`** (code, not an
    agent call), and its brief is the concatenation of the active plugins' summaries. The
    data-layer analog of decision 26; supersedes the spec's "one store, keyed by date, for
    everything".
35. **Runtime is the Agent SDK; auth is a swappable credential defaulting to subscription.**
    The multi-agent, per-call-model design (decision 21) needs the SDK's programmatic
    `query({ model, systemPrompt, mcpServers, allowedTools })`, not the CLI. A first-party
    support article confirms the SDK runs on a Pro/Max subscription via subscription login (no
    API key), so there is **no forced API pricing** — currently it draws the shared subscription
    pool; the designed model gives a dedicated monthly credit ($100 on Max 5x) that overflows to
    API rates only if usage credits are opted into. The relay authenticates from configured
    credentials and does not care which; an API key stays a one-line swap for hard isolation.
    This withdraws the earlier lean-to-API recommendation and corrects the spec, which named the
    SDK but left billing unresolved and assumed one monolithic session.
36. **One repo, with live data isolated under `data/<profile>/`.** (Chosen over two repos for
    v1 simplicity; the per-profile folder keeps a later split into separate data repos cheap,
    since the boundary is already drawn.) The shared **logic** — relay, CLI, plugin
    implementations, workflows, each plugin's **default** policy — is terminal-authoritative and
    deployed. Each person's `data/<profile>/` holds their policy **overrides**, profile, state,
    history, logbook and store; it is server-authoritative, written only by the CLI/workflows,
    committed per-change. Write authority is **path-disjoint**: the server writes only
    `data/<profile>/`, the terminal writes only logic paths, so their commits never conflict.
    Effective policy = defaults (logic) + overrides (data), so authoring and steering never
    touch the same file. This makes "three clients, one writer" true: the CLI on the server is
    the sole writer of coaching content; the terminal is a network client when coaching and the
    builder when writing app code. Kills the divergence bug — the current 72 uncommitted files
    are hand-edited content, which stops existing under this model. A second person is a second
    `data/<profile>/` and a second container (decision 12), against the same repo.
37. **Telegram is the only public surface; the web app is Tailscale-only.** The Telegram bot
    (public webhook, secret-token + `chat_id` allowlist) carries chat, inline buttons and push,
    reachable anywhere. The rich web app — dense views, trends, history and all `decide`
    steering — is reachable only on the tailnet; Tailscale is the auth, so there is no auth
    build. The "someone else's computer" case is served by **Telegram chat** (runs in any
    browser). **The Telegram Mini App drops from v1** (derived; flagged in [09] for
    confirmation), because it is the one thing that would force the rich surface to be public.
    Replaces the spec's shared-token public PWA + Mini App model.
    **Revised 2026-07-23 — the split is by affordance, not sensitivity.** The athlete rejected
    the privacy-from-Telegram premise: his chat is private to him and he does not mind his own
    health data in it. So Telegram may carry his own summaries and numbers freely; what lives
    only in the web app does so because it needs **dense rendering** (tables, trends, history),
    not because it is secret. The real data boundary is **profile isolation** — a profile's
    surfaces show only that profile's data, enforced by software profile-scoping and per-profile
    `chat_id` (decision 12, revised); cross-profile bleed is the failure to prevent, not Telegram
    reading a weight.
38. **The web-app Today view is a data-dense instrument panel.** It surfaces readiness markers
    (HRV, sleep, body battery), trailing load and week context alongside the session and food —
    not only the two answer-cards — because density is the web app's reason to exist over
    Telegram; the athlete asked for *more* on the first screen, not less. The head coach's
    reasoning still sits behind a tap (decision 23); the supporting data does not.
39. **History is trends-first, minimally, in v1.** The athlete wants history to lead with the
    quantitative arc (morning-weight, load, adherence) and drill into days. v1 ships those few
    arcs as simple charts over the store it already holds, with day drill-down beneath; the
    elaborate interactive/correlation dashboard stays v2. Deliberately moves the "no charts in
    v1" non-goal, bounded to what is cheap on the existing store.
40. **Telegram is present-tense; the web app is the backoffice.** Telegram is scoped to today's
    plan (approve/adjust), logging, and a few skills — **not** historical data or configuration.
    The web app is the control center, with sections that mirror the four kinds: **Today**
    (plan/state), **History** (state/history, trends-first), **Protocols** (policy — read plus
    `decide` steering), **Profile** (goals, races, HR zones, equipment). Anything historical or
    configurational is web-app-only, by role rather than by capability.
41. **Workflow instance state and gates live in n8n's execution engine.** *(Revised 2026-07-23
    per decision 44 — the bespoke SQLite gate-runner is superseded by n8n.)* A gate is an n8n
    **Wait node**: the execution pauses, sends the prompt (a Telegram message with buttons, or a
    web-app form), and **resumes on a webhook** the answering client posts — covering
    pause-indefinitely, resume-from-any-client, and survive-restart natively. n8n persists
    waiting executions in its own store. This is still the **third kind** of state, distinct from
    the git-committed coaching files and the analytical per-profile DuckDB — it is just owned by
    n8n now, not a hand-rolled table. Losing it costs at most a re-run; the coaching *record* is
    the canonical files. Workflow *definitions* are separate: per-profile JSON, in git, canonical
    (decision 18).
42. **`coach` is the CLI, and the CLI is the one interface.** *(Revised 2026-07-23 per decision
    44.)* The core TS library is an implementation detail behind a single canonical **CLI**;
    every driver reaches the engine through it — n8n nodes exec it, the agent calls it via
    `Bash`, the terminal and ad-hoc Claude Code sessions run it directly. Not an MCP server: the
    surface is a CLI, not a model-facing protocol. Commands are namespaced by plugin — `coach
    <domain> <verb>` — plus a small core namespace (`brief`, `sync`, `query`, `run <coach>`, …);
    an absent plugin is an absent namespace. Agent-running commands wrap the SDK internally
    (decision 44); gate state is n8n's, not a `coach gate` command (decision 41). Output is
    structured JSON, missing ≠ zero (null + a first-class `gap`), and routine reads are named
    commands while `coach query` is the raw-SQL escape hatch.
43. **Validators return a severity-typed verdict; the workflow runner owns the failure ladder.**
    `coach <domain> validate` returns `{ ok, violations:[{rule, expected, actual, severity}] }`
    with severity **hard** (blocks) or **warn** (annotates). On a hard failure the runner — not
    the specialist — re-runs once, then **escalates to a stronger model** (decision 21), then
    **surfaces to the athlete** as a `needs-input` gate. This is what makes a downgraded cheap
    specialist safe: its output is checked, and failure has a defined ladder, not a silent bad
    write. Validator thresholds are read from policy, so changing a floor in policy changes the
    check with no code change.
44. **The `coach` CLI is the single canonical interface; n8n is one driver of it.**
    *(Reconsidered and reversed 2026-07-23 — supersedes the same-day bespoke-only position — then
    refined: the driver **execs the CLI**, it does not import the library.)* Every driver goes
    through the CLI: **n8n** (custom nodes that exec it), the **agent** (via `Bash`), the
    **terminal**, and an **ad-hoc Claude Code session** spun up to operate the profiles. This
    keeps n8n replaceable (swap the driver, the engine is untouched), gives one tested contract
    for all drivers, and makes "drive the whole system from a Claude Code session" a native
    capability rather than a special path.

    **The CLI wraps the SDK for agent commands.** Deterministic ops (`brief`, `lookup`,
    `validate`, `summary`, writes) are pure code; agent ops (`coach run <coach> --profile=… 
    --date=… --resume=<sid>`) issue the SDK `query({...})` internally and return structured JSON.
    n8n execs those and never touches the SDK; its own LLM nodes go unused. The CLI is stateless
    per call — session continuity is a `--resume` id the driver passes in.

    **n8n is the driver:** per-profile workflows (JSON in git, canonical, decision 18), Telegram
    I/O (built-in node), cron triggers, HTTP API for the web app, durable waits (decision 41),
    execution logs/observability. Build-time check: confirm a driver exec'ing our SDK-wrapping
    CLI is fine under Anthropic's subscription terms (first-person, single-user — same posture as
    the terminal launching it — expected fine, but verify).
45. **Gates have two execution modes; the concept is one.** A gate ("pause for a human
    decision", decision 01) is **async and durable** when driven remotely — an n8n Wait node
    opened by cron or a client, resolvable from any surface by POSTing the same resume webhook
    (a Telegram callback, a web form, or a thin `coach resume` from the terminal) — and
    **synchronous/interactive** when run terminal-direct, where the session confirms in-line. The
    CLI returns a structured "awaiting-decision" result either way; the driver decides how to
    wait. This is how "draft on the web app, approve from Telegram an hour later" works, and why
    the terminal (which bypasses n8n) still handles gates.
46. **Client affordance matrix fixed (ticket 09).** Routing: Telegram and web app go through n8n
    to the CLI; the terminal hits the CLI directly (works even if n8n is down). Every action is
    available on every client **except `decide`**, which is unavailable on Telegram by the
    no-policy-edits boundary; what degrades elsewhere on Telegram is rendering, not the action.
    History and trends are web-only views, not actions. The Mini App drop is confirmed —
    Telegram is chat + inline buttons only, no embedded forms. The only enforced data boundary is
    profile isolation (decision 37, revised); there is no per-field secrecy rule.
47. **Session model is per-operation: continuous where work is iterative, one-shot where it is a
    self-contained transform.** The Agent SDK is not different in kind from a normal Claude Code
    session — a normal interactive session *is* a long-lived SDK session with turns close
    together. Continuation works the same both ways: the client holds the conversation
    (in-process, or persisted and reloaded on `resume` by sessionId), and Anthropic's **prompt
    cache** holds the prefix (content-keyed, TTL'd) so re-sending is cheap. A resumed session
    hits the same cache a normal session does — **there is no efficiency penalty for keeping a
    session continuous.** The only timing caveat (cache re-warms if the session idles past the
    TTL) applies equally to any idle Claude Code session.

    So the choice is **per operation, declared:**

    - **Continuous session** (sessionId, cached, context accumulates) for **iterative** work: the
      chat/adjust loop, `decide` / protocol refinement, the weekly recap, multi-turn plan
      adjustment. These benefit from the model holding the thread.
    - **One-shot isolated** (no sessionId, fresh scoped context) for **self-contained
      transforms**: a specialist swapping one ingredient for another, or any call whose scoped
      input fully determines its output. No memory needed, cheaper, no stale-context risk.

    Boundaries that still hold: continuity is **same-day / per-conversation and resets across
    days** (long-term memory is the files, decision 28); even within a continuous session the
    coach **re-reads files/brief for authoritative state**, so a long thread cannot drift from
    the files. Implementation: the SDK **session store lives on the per-profile volume, isolated
    per profile** — operational state like n8n's; losing it costs continuity, never coaching
    data. Exact SDK session API and cache TTL/pricing: verify at build (claude-api docs /
    context7).
48. **Working loads live in the store, not a document.** Load × reps × date is quantitative,
    dated **state** — it belongs in the per-profile DuckDB (decision 34), written by
    `session.log`. The progression *judgment* ("push reps to 12 before loading") is **not**
    stored prose: it is the strength coach's policy applied at plan time to the rep-history the
    store holds. So `strength-exercises.md` splits (decision 13): the movement library, gym
    equipment and rotation groups are strength **policy/plugin data**; the loads and last-logged
    dates are **store state** the strength coach reads and progresses. Resolves the twice-deferred
    open item from tickets 13 and 02.
49. **The profile is edited through the web app (and terminal), via the governed path — not
    Telegram.** Profile data (goals, race calendar, HR zones, equipment) is read-only to actions
    (decision 16), so changing it is a consented `decide`-style operation, surfaced in the web
    app's Profile section (decision 40) and available at the terminal. Initial profile creation is
    a one-time bootstrap/setup step, not a runtime action. Consistent with "no configuration from
    Telegram" (decision 40).
50. **Workflow step order is derived from `depends_on`, topologically sorted at composition.**
    Modules declare dependencies (`nutrition depends_on running, strength` — decision 26); the
    composition step (decision 14) topologically sorts them into the materialised per-profile n8n
    workflow (decision 44). No fixed skeleton and no hand-assigned priorities — a module with no
    declared dependency is unordered relative to its peers and may run in parallel. The order
    lives in the composed n8n workflow JSON, derived, not authored.

<!-- one line per closed ticket: gist plus link -->

- [01 — Action catalogue](issues/01-action-catalogue.md) — seven actions (`plan`,
  `garmin.push`, `meal.confirm`, `meal.log`, `session.log`, `adjust.day`, `skin.capture`),
  each an ordered step list. `/log` split, `note` replaced by the new `adjust.day`, `/body`
  demoted to a view. Gates are durable and come in two flavours (`needs-input`,
  `needs-approval`); actions chain declaratively, so approving a plan pushes it to the watch
  and adjusting the day re-pushes it. `protocols/` becomes policy that no action may write.
  Revised same day: `adjust.day` has **no** gate — it applies, reports the diff and offers
  undo — and these seven are **workflows** composed of module-contributed actions.
- [03 — Claude Max, headless, on a server](issues/03-claude-max-headless.md) — yes via
  `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN`, a one-year token Anthropic documents for
  CI and scripts. But renewal needs a browser once a year, `--bare` (the announced default for
  `-p`) does not read it, the Agent SDK's own docs contradict the support article on whether
  it honours a subscription at all, and subscription quota is **shared with interactive use**.
  Crucially the API fallback is only ~$46–77/month, at or below Max 5x — so "avoid API
  pricing" is a preference, not the architectural constraint it was taken to be.
- [04 — `garmin-cli` viability](issues/04-garmin-cli-viability.md) — real and correctly
  identified (`vicentereig/garmin-cli`, MIT, v2.1.0); the cited source path exists. Auth is a
  **terminal** login, not browser SSO as the spec says, and it genuinely survives unattended.
  The spec's "`speed`/`power` never populated" claim is refuted — they are populated, but
  Garmin's export carries no speed for this athlete's device, so the haversine decision stands
  for a different reason. Risks are organisational: bus factor of one, and Garmin broke auth
  six times in five weeks. **Adopted as a replaceable optimisation layer** — see decision 15.
- [02 — Structured plan schema](issues/02-plan-schema.md) — the day document is sectioned by
  **who writes it**, making it the contract between head coach and specialists. A one-line
  `why` per element, hidden by default. The `coach` CLI is the only writer: specialists emit
  JSON, the CLI validates and persists YAML. Satisfies ticket 01's constraint, so `garmin.push`
  stays agent-free and the approve-to-watch chain holds. Prototype kept at
  `prototypes/2026-07-22.plan.yaml`.
- [13 — Policy/state split](issues/13-policy-state-split.md) — four kinds, not two. Forced by
  the race schedule existing twice and already disagreeing, and by the Coaching Log being 52%
  of `current-status.md`. `current-status.md` splits four ways and ceases to exist as one
  document; `strength-exercises.md` splits **by column**, not by section; `running.md` mixes
  policy with profile.
- [14 — Modules, workflows and the profile](issues/14-modules-and-profile.md) — head coach over
  specialists, already present as `coaching.md`. `training.md` dissolves: its readiness and
  cumulative-load rules were the biggest policy block in the system, misfiled under one
  specialist's name. Vocabulary is contributed by specialists, rules are not. `supplements`
  folds into `nutrition`; `garmin` is an integration. Revised same day into vertical slices
  with specialist coaches — see decisions 19 and 20.
- [02 — Structured plan schema](issues/02-plan-schema.md) — see the entry above; partitioned by
  module, one-line `why` per element, CLI-only writer.
- [10 — Journal boundary](issues/10-journal-boundary.md) — the `####` essays were the premise's
  blind spot: they are durable policy/profile/log changes written as prose, not noise. A day's
  reasoning graduates to a bounded log row via `decide`; the derivation stays in the journal,
  unloaded. The `## Context` section stops being written — it is brief output. See decisions
  27 and 29.
- [16 — System memory](issues/16-system-memory-layers.md) — the layers already exist as the
  four kinds; the coaching log is the global layer and is already the right shape. Eviction is
  free: load decisions, not derivations. Memory is per-module. See decision 28.
- [17 — Agent runtime and billing](issues/17-agent-runtime-and-billing.md) — runtime is the
  Agent SDK (the multi-agent per-call-model design needs it); auth is a swappable credential
  defaulting to subscription login. A first-party article confirms the SDK runs on Pro/Max with
  no forced API pricing, withdrawing the earlier lean-to-API call. Narrows 15 to a pure
  durable-state question — the agent runs in our own relay, so the n8n policy ambiguity is moot.
  See decision 35.
- [05 — Repo topology and write model](issues/05-repo-topology.md) — one repo, live data
  isolated under `data/<profile>/`, one DuckDB per profile. The CLI on the server is the sole
  writer of coaching content; the terminal is a network client when coaching, the builder when
  writing logic. Path-disjoint authority kills the divergence bug. Effective policy = shared
  defaults + a person's `data/<profile>/` overrides. See decisions 34 and 36.
- [06 — Web app access route](issues/06-webapp-access-route.md) — Telegram is the only public
  surface (chat + buttons, borrowed-computer via Telegram Web); the rich web app is
  Tailscale-only. The Mini App drops from v1. See decision 37.
- [11 — What the UI shows](issues/11-ui-views.md) — mockup (`prototypes/ui-today.html`,
  artifact) validated glance-first cards + reasoning-behind-a-tap. The athlete pushed the Today
  view **denser** (decision 38), reframed the Telegram/web split as **affordance not secrecy**
  with **profile isolation** as the real boundary (decision 37 revised), asked for
  **trends-first history** pulled minimally into v1 (decision 39), and scoped the web app as a
  **sectioned backoffice** — Today / History / Protocols / Profile (decision 40).
- [15 — Durable workflow substrate](issues/15-durable-workflow-substrate.md) — a table and a
  switch, not a framework. Workflow instance state lives in a **per-container SQLite**,
  ephemeral and un-committed — a third store distinct from the git coaching files and the
  analytical DuckDB. Gates are rows resolved through the CLI. See decision 41.
- [08 — `coach` CLI/SDK surface](issues/08-coach-cli-surface.md) — the CLI is the single
  interface (every driver execs it); commands namespaced by plugin with a small core
  (`brief`/`sync`/`query`/`run`); agent commands wrap the SDK; JSON output with first-class gaps
  and missing≠zero; named reads + raw-SQL escape hatch; validators return severity-typed verdicts
  with a runner-owned failure ladder. See decisions 42, 43 (amended by 44).
- [09 — Client affordance matrix](issues/09-client-affordance-matrix.md) — full per-action ×
  per-client matrix. Telegram/web route through n8n, terminal hits the CLI direct. Every action
  on every client except `decide` (Telegram-unavailable); Telegram degrades rendering not
  function; Mini App confirmed dropped; profile isolation is the only enforced boundary. See
  decisions 45, 46.
- [12 — Command doc rewrite](issues/12-command-doc-rewrite.md) — greenfield decomposition, not a
  rewrite: each old command doc splits into orchestration (n8n workflow), mechanical steps
  (`coach` CLI), coaching judgement (plugin policy), and athlete numbers (profile/overrides). The
  recomputation trap is structurally prevented — the agent has no compute step to leave in.
  `AGENTS.md`'s primer becomes scoped head-coach policy, not a session prefix. Also settled the
  last three small opens: loads → store (48), profile edited via web app (49), step order from
  `depends_on` (50).

## Not yet specified

The fog is drained — everything in scope is now either **decided** or reduced to a **build
detail** that composes the decisions with no open architectural choice. Status of what was here:

- ~~DuckDB store and extractor~~ → decided: one DuckDB per profile (34), loads/state in it (48),
  fed from the plan schema's structured fields (02); table shapes are build detail.
- ~~Container and runtime build~~ → decided in shape: n8n + `coach` CLI (embedding the SDK) +
  `garmin-cli` + Garmin MCP + DuckDB (44, 03, 04); the Dockerfile is build detail.
- ~~Telegram mechanics~~ → decided: n8n's Telegram node, inline buttons, no Mini App (44, 37, 09);
  node wiring is build detail.
- ~~Cross-client session and state~~ → decided: sessions (47), gates (45), n8n execution store (41).
- ~~How the web app edits a protocol~~ → decided: the governed `decide` path, web-app Protocols
  section (29, 49); chat-vs-form is a UI build detail.
- ~~Daily-file migration~~ → dissolved by greenfield: no in-place migration; content is ported
  (12, build-context note).
- ~~Sensitivity policy~~ → decided: affordance not secrecy, profile isolation is the boundary (37).
- **Notification triggers** — the one genuinely-open item, and it is minor: with `/plan` manual,
  a nudge ("weigh-in + sync landed — plan now?") is worth pushing; the full set of push triggers
  and what counts as noise is **build-time tuning**, an n8n-trigger config question, not a
  blocking architectural decision. Carried into the spec as an open tuning item.

## Out of scope

Ruled beyond this destination. These do not graduate; they would need their own effort.

- **`/week`** — replacing `/report`, week files, `CONFIRMED`/`ASSUMED` tagging, the Sunday
  ritual. Valuable and independent: it needs no server and could be done at the desk today.
  Its own effort. Note that the `/report` staleness inconsistency it was going to fix stays
  unfixed until then.
- **Charts, trends and any analytics dashboard.** v2, on top of the v1 store.
- **Per-exercise strength-set logging** (sets, reps and load per movement in the store). v2.
- **Monthly reports generated as queries** instead of hand-authored prose. v2.
- **History and full-text search.** v2.
- **PWA web-push** as a second push channel. Telegram is the push channel for v1.
