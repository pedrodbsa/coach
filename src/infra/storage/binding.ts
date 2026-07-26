/**
 * One (profile, namespace) pair with both trees' resolvers bound to it, plus every path the kinds
 * use. `scope.ts` is the single containment chokepoint and is private to storage (§1.8).
 * Nothing outside this module builds a storage path.
 */

import type { Clock } from "../clock.ts";
import { systemClock } from "../clock.ts";
import { assertValidProfile } from "../../models/profile.ts";
import {
    createPolicyResolver,
    createProfileScoper,
    DATA_ROOT,
    POLICY_ROOT,
    type PolicyResolver,
    type ProfileScoper,
} from "./scope.ts";
import { DOCUMENT_EXTENSION, LOG_EXTENSION } from "../../utils/files.ts";

/** §1.3: namespace and document ids are single safe segments — the same rule as a profile name. */
export const assertSafeSegment = assertValidProfile;

/** §1.3 allows several history documents; the append-only interface addresses exactly one. */
const HISTORY_DOCUMENT = "log";
const METRIC_STORE_FILE = "metrics.duckdb";

export type NamespacedKind = "policy" | "profile" | "state" | "history" | "proposals";

export interface StorageFactoryOptions {
    /** The `data/` tree profiles are scoped under; a temp tree in tests. */
    readonly dataRoot?: string;
    /** The shipped-defaults tree; a temp tree in tests. */
    readonly policyRoot?: string;
    /** Proposals are timestamped; tests freeze it. */
    readonly clock?: Clock;
}

interface BindingOptions extends StorageFactoryOptions {
    readonly storeTables?: readonly string[];
}

/**
 * Every path the storage kinds address, as methods on the (profile, namespace) pair they belong
 * to. Constructing one is the containment checkpoint: an unsafe profile or namespace throws here,
 * so holding a `Binding` proves its scope is legal and no method re-validates it.
 */
export class Binding {
    readonly profile: string;
    readonly namespace: string;
    readonly clock: Clock;
    readonly storeTables: readonly string[];

    readonly #scoper: ProfileScoper;
    readonly #shippedPolicy: PolicyResolver;

    /** @throws `PROFILE_SCOPE_VIOLATION` if `profile` or `namespace` is not a safe single segment. */
    constructor(profile: string, namespace: string, options: BindingOptions = {}) {
        assertSafeSegment(namespace);
        this.#scoper = createProfileScoper(options.dataRoot ?? DATA_ROOT);
        this.#scoper(profile); // Construction is the checkpoint, as it is for `CoachContext`.

        this.profile = profile;
        this.namespace = namespace;
        this.clock = options.clock ?? systemClock;
        this.storeTables = Object.freeze([...(options.storeTables ?? [])]);
        this.#shippedPolicy = createPolicyResolver(options.policyRoot ?? POLICY_ROOT);
    }

    #inProfile(...segments: string[]): string {
        return this.#scoper(this.profile, ...segments);
    }

    /** `data/<profile>/<kind>/<ns>/` — where one kind's documents live. */
    directory(kind: NamespacedKind): string {
        return this.#inProfile(kind, this.namespace);
    }

    document(kind: NamespacedKind, document: string): string {
        assertSafeSegment(document);
        return this.#inProfile(kind, this.namespace, `${document}${DOCUMENT_EXTENSION}`);
    }

    /** The shipped-defaults half of "effective policy = defaults ⊕ overrides". */
    defaults(document: string): string {
        assertSafeSegment(document);
        return this.#shippedPolicy(this.namespace, `${document}${DOCUMENT_EXTENSION}`);
    }

    defaultsDirectory(): string {
        return this.#shippedPolicy(this.namespace);
    }

    historyLog(): string {
        return this.#inProfile("history", this.namespace, `${HISTORY_DOCUMENT}${LOG_EXTENSION}`);
    }

    /** One derived DuckDB file per profile; its tables are bounded separately by declared ownership. */
    metricStore(): string {
        return this.#inProfile("store", METRIC_STORE_FILE);
    }

    /** Profile-level and cross-domain, so it is keyed by month rather than by namespace. */
    logbook(month: string): string {
        assertSafeSegment(month);
        return this.#inProfile("logbook", `${month}${DOCUMENT_EXTENSION}`);
    }

    logbookDirectory(): string {
        return this.#inProfile("logbook");
    }

    /** `proposals/<ns>/<document>.<id>.yaml` — the document stays in the name so git stays readable. */
    proposal(document: string, id: string): string {
        assertSafeSegment(document);
        assertSafeSegment(id);
        return this.#inProfile(
            "proposals",
            this.namespace,
            `${document}.${id}${DOCUMENT_EXTENSION}`,
        );
    }

    /** Re-scopes a filename already listed out of {@link directory}, so listing stays contained. */
    proposalFile(file: string): string {
        return this.#inProfile("proposals", this.namespace, file);
    }
}
