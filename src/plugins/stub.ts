import type { Storage } from "../infra/storage/index.ts";
import { makeEnvelope } from "../models/envelope.ts";
import type { PluginCommands, PluginDefinition } from "./types.ts";

/** Throwaway Chunk 2 plugin proving registry construction and scoped storage injection. */
export const stubPlugin = {
    key: "stub",
    storeTables: [],

    commands(storage: Storage): PluginCommands {
        return {
            summary: {
                synergies: [],
                execute: async () => makeEnvelope({ namespace: storage.namespace, facts: {} }),
            },
            inspect: {
                synergies: [],
                execute: async () =>
                    makeEnvelope({
                        namespace: storage.namespace,
                        capabilities: Object.keys(storage).sort(),
                    }),
            },
        };
    },
} as const satisfies PluginDefinition;
