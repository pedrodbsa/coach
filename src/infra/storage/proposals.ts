/**
 * Proposals (§1.11) — the mechanism that replaced a privileged write handle.
 *
 * A plugin can only ever record a *proposal*; the athlete's approval promotes it. So the property
 * "an action reachable from Telegram cannot change a coaching rule" holds because no plugin-facing
 * method writes `policy/` at all, not because some callers were handed a narrower type.
 *
 * `promoteProposal` is **core-only** — the `decide` workflow calls it after the approval gate, and
 * it is the only code path in the engine that writes `data/<profile>/policy/`.
 */

import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

import { CoachError } from "../../models/error.ts";
import { Binding, type StorageFactoryOptions } from "./binding.ts";
import {
    appendJsonLine,
    DOCUMENT_EXTENSION,
    listRawFiles,
    readYamlDocument,
    writeYamlDocument,
} from "../../utils/files.ts";
import { mergeLayers } from "../../utils/merge.ts";
import type {
    HistoryEntry,
    ProposalId,
    ProposalRationale,
    ProposalRecord,
    ProposalRound,
    PromotionResult,
    SteerableKind,
} from "./types.ts";

/**
 * Reading a proposal back off disk crosses a trust boundary: it is YAML a human can edit and the
 * promotion path acts on it. Validate the fields promotion depends on here, where the filename is
 * still in hand, rather than letting a bad record surface as a confusing failure inside
 * {@link promoteProposal}.
 */
function isProposalRecord(value: unknown): value is ProposalRecord {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const record = value as Record<string, unknown>;
    const rationale = record.rationale as Record<string, unknown> | undefined;

    return (
        typeof record.id === "string" &&
        typeof record.namespace === "string" &&
        (record.kind === "policy" || record.kind === "profile") &&
        typeof record.document === "string" &&
        typeof record.created_at === "string" &&
        Array.isArray(record.rounds) &&
        typeof rationale === "object" &&
        rationale !== null &&
        typeof rationale.why === "string"
    );
}

/** The live layer a proposal replaces — its `based_on` at creation and its check at promotion. */
async function readLiveOverride(
    binding: Binding,
    kind: SteerableKind,
    document: string,
): Promise<unknown> {
    return readYamlDocument(binding.document(kind, document));
}

/** Called by the `policy` / `profile` handles. Writes only under `proposals/`. */
export async function createProposal(
    binding: Binding,
    kind: SteerableKind,
    document: string,
    value: unknown,
    rationale: ProposalRationale,
): Promise<ProposalId> {
    const id = randomUUID();
    const at = binding.clock.now().toISOString();
    const record: ProposalRecord = {
        id,
        namespace: binding.namespace,
        kind,
        document,
        proposed: value,
        based_on: await readLiveOverride(binding, kind, document),
        rationale,
        rounds: [{ at, by: "specialist", verdict: "proposed", note: rationale.why }],
        created_at: at,
    };

    await writeYamlDocument(binding.proposal(document, id), record);
    return id;
}

interface StoredProposal {
    readonly path: string;
    readonly record: ProposalRecord;
}

/** @throws {@link CoachError} `PROPOSAL_MALFORMED` if any file in the namespace is not a proposal. */
async function loadProposals(binding: Binding): Promise<StoredProposal[]> {
    const files = await listRawFiles(binding.directory("proposals"), DOCUMENT_EXTENSION);

    const loaded: StoredProposal[] = [];
    for (const file of files) {
        const path = binding.proposalFile(file);
        const parsed = await readYamlDocument(path);
        if (parsed === null) {
            continue;
        }
        if (!isProposalRecord(parsed)) {
            throw CoachError.proposalMalformed(path);
        }
        loaded.push({ path, record: parsed });
    }
    return loaded.sort((a, b) => a.record.created_at.localeCompare(b.record.created_at));
}

async function locate(binding: Binding, id: ProposalId): Promise<StoredProposal> {
    const found = (await loadProposals(binding)).find((entry) => entry.record.id === id);
    if (found === undefined) {
        throw CoachError.proposalNotFound(binding.namespace, id);
    }
    return found;
}

/** Pending proposals for one namespace, oldest first. */
export async function listProposals(
    profile: string,
    namespace: string,
    options: StorageFactoryOptions = {},
): Promise<ProposalRecord[]> {
    const loaded = await loadProposals(new Binding(profile, namespace, options));
    return loaded.map((entry) => entry.record);
}

export async function readProposal(
    profile: string,
    namespace: string,
    id: ProposalId,
    options: StorageFactoryOptions = {},
): Promise<ProposalRecord | null> {
    const loaded = await loadProposals(new Binding(profile, namespace, options));
    return loaded.find((entry) => entry.record.id === id)?.record ?? null;
}

/** Appends a mediation round. The trail accumulates so a negotiation stays auditable (§1.11). */
export async function recordProposalRound(
    profile: string,
    namespace: string,
    id: ProposalId,
    round: ProposalRound,
    options: StorageFactoryOptions = {},
): Promise<void> {
    const binding = new Binding(profile, namespace, options);
    const { path, record } = await locate(binding, id);
    await writeYamlDocument(path, { ...record, rounds: [...record.rounds, round] });
}

/** The two sides the approval surface diffs. Prose narration of it is a later, cheap-model step. */
export async function previewProposal(
    profile: string,
    namespace: string,
    id: ProposalId,
    options: StorageFactoryOptions = {},
): Promise<{ current: unknown; proposed: unknown }> {
    const binding = new Binding(profile, namespace, options);
    const { record } = await locate(binding, id);

    if (record.kind === "profile") {
        return {
            current: await readLiveOverride(binding, "profile", record.document),
            proposed: record.proposed,
        };
    }

    const defaults = await readYamlDocument(binding.defaults(record.document));
    const live = await readLiveOverride(binding, "policy", record.document);
    return {
        current: live === null ? defaults : mergeLayers(defaults, live),
        proposed: mergeLayers(defaults, record.proposed),
    };
}

export async function rejectProposal(
    profile: string,
    namespace: string,
    id: ProposalId,
    options: StorageFactoryOptions = {},
): Promise<void> {
    const binding = new Binding(profile, namespace, options);
    const { path } = await locate(binding, id);
    await rm(path, { force: true });
}

/**
 * **Core-only, post-approval.** The single code path that writes `data/<profile>/policy/`.
 *
 * The override write and the coaching-log row are two files, so they cannot be one syscall — the
 * unit of atomicity is the **git commit** the workflow makes (§1.11), which holds both or neither.
 *
 * @throws {@link CoachError} `PROPOSAL_STALE` if the live override moved since the proposal was computed.
 */
export async function promoteProposal(
    profile: string,
    namespace: string,
    id: ProposalId,
    options: StorageFactoryOptions = {},
): Promise<PromotionResult> {
    const binding = new Binding(profile, namespace, options);
    const { path, record } = await locate(binding, id);

    const live = await readLiveOverride(binding, record.kind, record.document);
    if (!isDeepStrictEqual(live, record.based_on)) {
        throw CoachError.proposalStale(namespace, record.document);
    }

    const at = binding.clock.now().toISOString();
    await writeYamlDocument(binding.document(record.kind, record.document), record.proposed);
    // The shared envelope (types.ts): the promotion's specifics go under `payload`, so a later
    // core-side query can find this row by `kind` without knowing what a proposal is. `summary` is
    // the rationale's one-line `why` — the gist, never the derivation.
    await appendJsonLine(binding.historyLog(), {
        at,
        kind: "proposal.promoted",
        by: namespace,
        summary: record.rationale.why,
        payload: {
            proposal: record.id,
            steerable: record.kind,
            document: record.document,
            rounds: record.rounds.length,
        },
    } satisfies HistoryEntry);
    await rm(path, { force: true });

    return {
        proposal: id,
        namespace,
        kind: record.kind,
        document: record.document,
        promoted_at: at,
    };
}
