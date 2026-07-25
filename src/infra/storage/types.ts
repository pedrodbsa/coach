/**
 * The storage contract (plugin contract §1.4–§1.5, revised 2026-07-23): one handle per data kind,
 * each carrying exactly the capability that kind's write rule allows.
 *
 * The load-bearing property: **no type reachable from a plugin can change live policy.** Policy and
 * profile offer `propose`, which records a pending proposal the athlete may promote (§1.11) — so an
 * action reachable from Telegram cannot alter a coaching rule, and there is no privileged handle to
 * escalate to. Promotion is core-only and lives in `proposals.ts`.
 *
 * Reads return `unknown`, not a caller-chosen `T`. YAML off disk has no compile-time shape, so a
 * `read<T>()` would have been an unchecked cast wearing a type parameter — the caller narrows (or,
 * from Chunk 3, validates against the plan schema) at the point it knows what it expects.
 */

/**
 * One JSONL row in a namespace's history: a small required envelope, with everything
 * domain-specific beneath `payload`.
 *
 * The envelope exists for **core-side `coach query`** — "every decision taken in the past month"
 * has to filter across namespaces, and it can only do that if every domain agrees on where the
 * timestamp, the kind and the one-line gist live. It grants no cross-namespace read to a *plugin*
 * (contract §1.6); it only makes the core's own scan possible. Files stay canonical, so projecting
 * this envelope into a DuckDB `decisions` table is Chunk 4's option, not a dependency.
 *
 * There is deliberately no open index signature. Top-level domain fields would put each domain's
 * vocabulary in the same namespace as the envelope's, and the first collision would be silent.
 */
export interface HistoryEntry {
    /** ISO timestamp, from the run's clock — the log is ordered by append, not re-sorted. */
    readonly at: string;
    /** What happened: `"decision"`, `"proposal.promoted"`, or a domain-defined value. */
    readonly kind: string;
    /** Who appended it — a namespace, or a party in a mediation. */
    readonly by: string;
    /** One line, the same cap as a plan element's `why`. Prose here is a gist, never a derivation. */
    readonly summary: string;
    /** Everything domain-specific. Opaque to the core; never read across a namespace. */
    readonly payload?: Record<string, unknown>;
}

export interface DocumentReader {
    /** The parsed document, or `null` when absent — never `{}`. */
    read(document: string): Promise<unknown>;
    list(): Promise<string[]>;
}

export interface DocumentStore extends DocumentReader {
    /** Whole-document replace, serialised to YAML, written atomically (temp + rename). */
    write(document: string, value: unknown): Promise<void>;
}

/** A kind the athlete steers through `decide`: readable and proposable, never directly writable. */
export interface ProfileReader extends DocumentReader {
    /**
     * Records a pending proposal; changes nothing live. `value` is the **complete post-change
     * override document**, never a patch — promotion replaces the file wholesale (§1.11).
     */
    propose(document: string, value: unknown, rationale: ProposalRationale): Promise<ProposalId>;
}

/** The two layers unmerged, so "why is this value what it is" stays answerable. */
export interface PolicyLayers {
    readonly defaults: unknown;
    readonly overrides: unknown;
}

export interface PolicyReader extends ProfileReader {
    /** `read` here resolves effective policy: shipped defaults ⊕ profile overrides. */
    layers(document: string): Promise<PolicyLayers>;
}

export interface AppendOnlyLog {
    append(entry: HistoryEntry): Promise<void>;
    /** Newest first, capped at `limit`. */
    recent(limit: number): Promise<HistoryEntry[]>;
    // Eviction is a core retention job, not a plugin capability.
}

/**
 * The per-profile DuckDB, scoped to the tables the plugin declared at registration (§1.7) — the
 * one kind whose boundary is declared ownership rather than the path scoper. Interface only here;
 * Chunk 4 implements it and may widen this surface.
 */
export interface MetricStore {
    readonly tables: readonly string[];
    rows(table: string): Promise<unknown[]>;
    insert(table: string, rows: readonly unknown[]): Promise<void>;
}

/** What a plugin is handed at action time. Bound to one (profile, namespace). */
export interface Storage {
    readonly namespace: string;
    readonly policy: PolicyReader; // propose, never write
    readonly profile: ProfileReader; // ditto
    readonly state: DocumentStore;
    readonly history: AppendOnlyLog;
    readonly logbook: DocumentReader;
    readonly store: MetricStore;
}

/**
 * Binds a namespace and its declared metric tables to one profile's storage. PluginFactory owns
 * both arguments; plugin instances receive only the resulting Storage.
 */
/** Creates namespace-bound storage for one already-bound profile. */
export interface IStorageFactory {
    create(namespace: string, storeTables?: readonly string[]): Storage;
}

/** The kinds a proposal can target: state is written outright, history only ever appends. */
export type SteerableKind = "policy" | "profile";

export type ProposalId = string;

export interface ProposalRationale {
    /** One sentence, same cap as the plan's per-element `why` (decision 23). */
    readonly why: string;
    /** The derivation, kept for audit; never re-loaded into a later session. */
    readonly derivation?: string;
}

export interface ProposalRound {
    readonly at: string;
    readonly by: "specialist" | "head-coach" | "athlete";
    readonly verdict: "proposed" | "rejected" | "refined" | "approved";
    readonly note: string;
}

export interface ProposalRecord {
    readonly id: ProposalId;
    readonly namespace: string;
    readonly kind: SteerableKind;
    readonly document: string;
    /** The complete post-change override document. */
    readonly proposed: unknown;
    /** Staleness guard: the override layer this was computed against (§1.11). */
    readonly based_on: unknown;
    readonly rationale: ProposalRationale;
    /** The mediation trail — appended per round, never overwritten. */
    readonly rounds: readonly ProposalRound[];
    readonly created_at: string;
}

export interface PromotionResult {
    readonly proposal: ProposalId;
    readonly namespace: string;
    readonly kind: SteerableKind;
    readonly document: string;
    readonly promoted_at: string;
}
