import type { Storage } from "../../infra/storage/index.ts";
import type { DomainPlugin, DomainResult, DomainSummary, PluginDefinition } from "../types.ts";

/** Proof that a plugin got a namespace-bound storage handle and nothing wider. */
export interface StubCapabilities extends DomainResult {
    readonly namespace: string;
    readonly capabilities: readonly string[];
}

/**
 * The stub's engine side, named so `cli.ts` can be compile-checked against it. A real domain names
 * its own type the same way; that name *is* the contract between the two files.
 */
export interface StubPlugin extends DomainPlugin {
    summary(): Promise<DomainSummary>;
    inspect(): Promise<StubCapabilities>;
}

/**
 * Throwaway Chunk 2 fixture proving registry construction and scoped storage injection.
 *
 * Annotated rather than `satisfies`-checked so `PluginKey` — which `synergies` names — can still be
 * derived from the registry's keys without the two definitions chasing each other.
 */
export const stubPlugin: PluginDefinition<StubPlugin> = {
    key: "stub",
    storeTables: [],
    synergies: [],

    create(storage: Storage): StubPlugin {
        return {
            summary: async () => ({
                namespace: storage.namespace,
                facts: {},
                observations: [],
                gaps: [],
            }),
            inspect: async () => ({
                namespace: storage.namespace,
                capabilities: Object.keys(storage).sort(),
            }),
        };
    },
};
