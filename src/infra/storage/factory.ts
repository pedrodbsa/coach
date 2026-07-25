/**
 * Constructs every storage capability for one validated profile.
 *
 * The factory owns profile scoping. Callers may resolve profile-level core paths, while plugins
 * receive only the namespace-bound `Storage` returned by `create`.
 */

import type { StorageFactoryOptions } from "./binding.ts";
import { Binding } from "./binding.ts";
import { HistoryLog, LogbookDocuments, PolicyDocuments, ProfileDocuments, StateDocuments } from "./stores.ts";
import { UnavailableMetricStore } from "./metric-store.ts";
import { createProfileScoper, DATA_ROOT, type ProfileResolver } from "./scope.ts";
import type { IStorageFactory, Storage } from "./types.ts";

export class StorageFactory implements IStorageFactory {
    readonly #profile: string;
    readonly #options: StorageFactoryOptions;
    readonly #resolve: ProfileResolver;

    constructor(profile: string, options: StorageFactoryOptions = {}) {
        const scoper = createProfileScoper(options.dataRoot ?? DATA_ROOT);
        scoper(profile);

        this.#profile = profile;
        this.#options = options;
        this.#resolve = (...segments) => scoper(profile, ...segments);
    }

    /** Core-only profile path resolution for data not represented by a plugin capability. */
    resolve(...segments: string[]): string {
        return this.#resolve(...segments);
    }

    /** Creates the complete capability set for one plugin namespace. */
    create(namespace: string, storeTables: readonly string[] = []): Storage {
        const binding = new Binding(this.#profile, namespace, {
            ...this.#options,
            storeTables,
        });

        return Object.freeze({
            namespace: binding.namespace,
            policy: new PolicyDocuments(binding),
            profile: new ProfileDocuments(binding),
            state: new StateDocuments(binding),
            history: new HistoryLog(binding),
            logbook: new LogbookDocuments(binding),
            store: new UnavailableMetricStore(binding.storeTables),
        });
    }
}

export type { StorageFactoryOptions };
