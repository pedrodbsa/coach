/**
 * Concrete file-backed implementations of the storage capability interfaces.
 *
 * Bindings stay in runtime-private fields: a plugin can use a capability but cannot recover a
 * filesystem path from it. The factory is solely responsible for composing these implementations.
 */

import { CoachError } from "../../models/error.ts";
import { mergeLayers } from "../../utils/merge.ts";
import { Binding, type NamespacedKind } from "./binding.ts";
import {
    appendJsonLine,
    listYamlDocuments,
    readRecentJsonLines,
    readYamlDocument,
    writeYamlDocument,
} from "../../utils/files.ts";
import { createProposal } from "./proposals.ts";
import type {
    AppendOnlyLog,
    DocumentReader,
    DocumentStore,
    HistoryEntry,
    PolicyLayers,
    PolicyReader,
    ProfileReader,
    ProposalId,
    ProposalRationale,
    SteerableKind,
} from "./types.ts";

class YamlDocuments implements DocumentReader {
    readonly #binding: Binding;
    readonly #kind: NamespacedKind;

    constructor(binding: Binding, kind: NamespacedKind) {
        this.#binding = binding;
        this.#kind = kind;
    }

    async read(document: string): Promise<unknown> {
        return readYamlDocument(this.#binding.document(this.#kind, document));
    }

    async list(): Promise<string[]> {
        return listYamlDocuments(this.#binding.directory(this.#kind));
    }
}

class SteerableDocuments extends YamlDocuments implements ProfileReader {
    readonly #binding: Binding;
    readonly #kind: SteerableKind;

    constructor(binding: Binding, kind: SteerableKind) {
        super(binding, kind);
        this.#binding = binding;
        this.#kind = kind;
    }

    async propose(
        document: string,
        value: unknown,
        rationale: ProposalRationale,
    ): Promise<ProposalId> {
        return createProposal(this.#binding, this.#kind, document, value, rationale);
    }
}

export class StateDocuments extends YamlDocuments implements DocumentStore {
    readonly #binding: Binding;

    constructor(binding: Binding) {
        super(binding, "state");
        this.#binding = binding;
    }

    async write(document: string, value: unknown): Promise<void> {
        await writeYamlDocument(this.#binding.document("state", document), value);
    }
}

export class ProfileDocuments extends SteerableDocuments {
    constructor(binding: Binding) {
        super(binding, "profile");
    }
}

export class PolicyDocuments extends SteerableDocuments implements PolicyReader {
    readonly #binding: Binding;

    constructor(binding: Binding) {
        super(binding, "policy");
        this.#binding = binding;
    }

    async layers(document: string): Promise<PolicyLayers> {
        const [defaults, overrides] = await Promise.all([
            readYamlDocument(this.#binding.defaults(document)),
            readYamlDocument(this.#binding.document("policy", document)),
        ]);
        return { defaults, overrides };
    }

    override async read(document: string): Promise<unknown> {
        const { defaults, overrides } = await this.layers(document);
        if (defaults === null || overrides === null) {
            return overrides ?? defaults;
        }
        return mergeLayers(defaults, overrides);
    }

    override async list(): Promise<string[]> {
        const [defaults, overrides] = await Promise.all([
            listYamlDocuments(this.#binding.defaultsDirectory()),
            listYamlDocuments(this.#binding.directory("policy")),
        ]);
        return [...new Set([...defaults, ...overrides])].sort();
    }
}

export class LogbookDocuments implements DocumentReader {
    readonly #binding: Binding;

    constructor(binding: Binding) {
        this.#binding = binding;
    }

    async read(month: string): Promise<unknown> {
        return readYamlDocument(this.#binding.logbook(month));
    }

    async list(): Promise<string[]> {
        return listYamlDocuments(this.#binding.logbookDirectory());
    }
}

/**
 * The envelope is checked on the way **out**, not on the way in: `append` is type-checked at the
 * call site, while a row read back has crossed a trust boundary — it may have been hand-edited, or
 * written before the envelope existed. Reading such a row as valid is what the check prevents.
 */
function isHistoryEntry(row: unknown): row is HistoryEntry {
    if (typeof row !== "object" || row === null) return false;
    const candidate = row as Record<string, unknown>;
    return (["at", "kind", "by", "summary"] as const).every(
        (field) => typeof candidate[field] === "string",
    );
}

export class HistoryLog implements AppendOnlyLog {
    readonly #binding: Binding;

    constructor(binding: Binding) {
        this.#binding = binding;
    }

    async append(entry: HistoryEntry): Promise<void> {
        await appendJsonLine(this.#binding.historyLog(), entry);
    }

    async recent(limit: number): Promise<HistoryEntry[]> {
        if (!Number.isInteger(limit) || limit <= 0) {
            throw new RangeError(`history limit must be a positive integer, got ${limit}`);
        }
        return (await readRecentJsonLines(this.#binding.historyLog(), limit)).map((entry) => {
            if (!isHistoryEntry(entry)) {
                throw CoachError.historyEntryMalformed();
            }
            return entry;
        });
    }
}
