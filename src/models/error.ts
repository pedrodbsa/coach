/**
 * `CoachError` — the one error type the engine raises deliberately, plus a named constructor for
 * every failure it can name.
 *
 * A failure is identified by its **`code`**, not by its class. One class per failure bought nothing:
 * no `catch` in this codebase branches on the error *type*, and the boundaries that do care — the
 * envelope's gaps, a log line, an n8n branch, a Telegram reply — can only carry a string. A stable
 * code crosses all of them; `instanceof` crosses none.
 *
 * The static factories are why the constructor is private: this file is the single place a code and
 * its wording are decided, so a throw site stays one line and no module grows a private
 * error-building helper. Adding a failure means adding a code and a factory here, together.
 *
 * `action` is optional because a `Gap` requires one and only the throw site knows the remedy
 * (which namespaces exist, which flag to pass). Omit it and `makeGap` falls back to generic advice.
 *
 * Not every throw becomes a `CoachError`. Caller misuse of an API stays a native `RangeError` /
 * `TypeError`: that is a programmer bug to fix in the code, not a condition the athlete can act on.
 */

/**
 * Every failure the engine names. A gap's `reason` is prose for a human; this is the identifier
 * everything else keys off, so treat a value here as part of the output contract — rename one and a
 * downstream consumer's branch goes dead.
 */
export type CoachErrorCode =
    // Profile identity and path scoping — `models/profile.ts`, `infra/storage/scope.ts`.
    | "PROFILE_SCOPE_VIOLATION"
    | "NO_PROFILE_SELECTED"
    // Routing — `engine.ts`, `cli/`.
    | "NO_COMMAND"
    | "UNKNOWN_NAMESPACE"
    | "UNKNOWN_COMMAND"
    // Active-set and registry wiring — `plugins/`. Startup errors, not per-request ones.
    | "DUPLICATE_NAMESPACE"
    | "RESERVED_NAMESPACE"
    | "UNREGISTERED_PLUGIN"
    | "MISSING_MANDATORY_PLUGIN"
    // Data read back across a trust boundary — `utils/yaml.ts`, `infra/storage/`.
    | "YAML_PARSE_ERROR"
    | "HISTORY_ENTRY_MALFORMED"
    | "PROPOSAL_MALFORMED"
    | "PROPOSAL_NOT_FOUND"
    | "PROPOSAL_STALE"
    // Surfaces a later chunk builds.
    | "METRIC_STORE_UNAVAILABLE"
    | "METRIC_TABLE_NOT_DECLARED";

export class CoachError extends Error {
    private constructor(
        readonly code: CoachErrorCode,
        message: string,
        /** Remediation for the gap's `action`, when the failure knows one worth stating. */
        readonly action?: string,
    ) {
        super(message);
        this.name = "CoachError";
    }

    // ── Profile identity and path scoping ────────────────────────────────────────────────────────
    // The *rule* that was broken belongs with the check, so this one takes the detail rather than
    // pulling six near-identical validation messages out of the validators that own them.

    /** A crafted profile name, or a path that would leave `data/<profile>/`. */
    static profileScope(detail: string): CoachError {
        return new CoachError("PROFILE_SCOPE_VIOLATION", detail);
    }

    /** Never defaulted: acting on an unnamed profile could act on the wrong athlete's tree. */
    static noProfileSelected(envVar: string): CoachError {
        return new CoachError(
            "NO_PROFILE_SELECTED",
            `no profile selected: pass --profile <name> or set ${envVar}=<name>`,
        );
    }

    // ── Routing ─────────────────────────────────────────────────────────────────────────────────

    /** Argv named no runnable leaf — `coach`, or a namespace with no verb. */
    static noCommand(): CoachError {
        return new CoachError("NO_COMMAND", "no runnable command was specified");
    }

    /**
     * A namespace this profile does not have. Raised by **routing**, before any plugin is
     * constructed — §2.4's "absence is structural": a domain the profile lacks is indistinguishable
     * from one that was never written, and there is no registered-but-disabled state to report.
     *
     * `known` is everything the caller *could* have asked for, core included, so the gap's action
     * names the alternatives.
     */
    static unknownNamespace(namespace: string, known: readonly string[]): CoachError {
        return new CoachError(
            "UNKNOWN_NAMESPACE",
            `unknown namespace "${namespace}"`,
            `Use a registered namespace: ${known.join(", ")}.`,
        );
    }

    /** A verb the namespace does not have. Distinct from a namespace the profile does not have. */
    static unknownCommand(namespace: string, verb: string): CoachError {
        return new CoachError("UNKNOWN_COMMAND", `unknown command "${namespace} ${verb}"`);
    }

    // ── Active-set and registry wiring (startup) ─────────────────────────────────────────────────

    static duplicateNamespace(key: string): CoachError {
        return new CoachError("DUPLICATE_NAMESPACE", `duplicate plugin namespace "${key}"`);
    }

    static reservedNamespace(key: string): CoachError {
        return new CoachError(
            "RESERVED_NAMESPACE",
            `plugin namespace "${key}" collides with the core namespace of the same name`,
        );
    }

    /**
     * A namespace this *build* cannot construct — distinct from {@link CoachError.unknownNamespace},
     * which is one this *profile* has not turned on. From the factory it means the active set was
     * resolved against a different registry than the one constructing: a wiring bug, not a typo.
     */
    static unregisteredPlugin(key: string): CoachError {
        return new CoachError(
            "UNREGISTERED_PLUGIN",
            `no plugin is registered under the namespace "${key}"`,
        );
    }

    /**
     * A profile's active set left out a namespace it may not switch off — today only `head`
     * (amendments §1.2). Deliberately **not** the routing gap an ordinary absent plugin produces
     * (§2.4): without the head coach there is no mediator, so there is no `decide`, no `plan` and no
     * way to weigh one domain against another. That is a broken deployment, not a missing feature.
     */
    static missingMandatoryPlugin(key: string): CoachError {
        return new CoachError(
            "MISSING_MANDATORY_PLUGIN",
            `namespace "${key}" cannot be deactivated: every profile has it`,
            `Add "${key}" to the profile's plugin selection.`,
        );
    }

    // ── Data read back across a trust boundary ───────────────────────────────────────────────────

    /** Names the source path, so a command-level gap can point at the file to fix. */
    static yamlParse(filePath: string, detail: string): CoachError {
        return new CoachError("YAML_PARSE_ERROR", `invalid YAML in "${filePath}": ${detail}`);
    }

    static historyEntryMalformed(): CoachError {
        return new CoachError(
            "HISTORY_ENTRY_MALFORMED",
            "history entry must carry the envelope: string `at`, `kind`, `by` and `summary`",
        );
    }

    /** A proposal file that is not a proposal — hand-edited, half-written, or another schema. */
    static proposalMalformed(filePath: string): CoachError {
        return new CoachError(
            "PROPOSAL_MALFORMED",
            `"${filePath}" is not a well-formed proposal record`,
        );
    }

    static proposalNotFound(namespace: string, id: string): CoachError {
        return new CoachError(
            "PROPOSAL_NOT_FOUND",
            `no pending proposal "${id}" in namespace "${namespace}"`,
        );
    }

    /** Promotion refuses rather than silently reverting whatever landed since the proposal. */
    static proposalStale(namespace: string, document: string): CoachError {
        return new CoachError(
            "PROPOSAL_STALE",
            `proposal for "${namespace}/${document}" was computed against an override that has ` +
                `since changed; re-open it against the current one rather than promoting`,
            "Re-open the proposal against the current override rather than promoting this one.",
        );
    }

    // ── Surfaces a later chunk builds ────────────────────────────────────────────────────────────

    /** Fails by name so a caller reports "not yet" rather than an empty result — missing ≠ zero. */
    static metricStoreUnavailable(operation: string): CoachError {
        return new CoachError(
            "METRIC_STORE_UNAVAILABLE",
            `the metric store write is not implemented until Chunk 4 (per-profile DuckDB): ${operation}`,
        );
    }

    static metricStoreMissing(filePath: string): CoachError {
        return new CoachError(
            "METRIC_STORE_UNAVAILABLE",
            `the per-profile metric store is missing: "${filePath}"`,
        );
    }

    /** The store's declared table ownership is its only plugin boundary (§1.7). */
    static metricTableNotDeclared(namespace: string, table: string): CoachError {
        return new CoachError(
            "METRIC_TABLE_NOT_DECLARED",
            `metric table "${table}" is not declared by namespace "${namespace}"`,
        );
    }
}
