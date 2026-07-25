/** The storage service's public surface. Nothing outside it exposes a filesystem path. */

export type {
    AppendOnlyLog,
    DocumentReader,
    DocumentStore,
    HistoryEntry,
    MetricStore,
    PolicyLayers,
    PolicyReader,
    ProfileReader,
    ProposalId,
    ProposalRationale,
    ProposalRecord,
    ProposalRound,
    PromotionResult,
    Storage,
    IStorageFactory,
    SteerableKind,
} from "./types.ts";

export type { StorageFactoryOptions } from "./binding.ts";
export { StorageFactory } from "./factory.ts";
export {
    listProposals,
    previewProposal,
    promoteProposal,
    readProposal,
    recordProposalRound,
    rejectProposal,
} from "./proposals.ts";
