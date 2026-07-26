import type { IStorageFactory } from "../infra/storage/index.ts";
import { CoachError } from "../models/error.ts";
import { isPluginKey, PLUGIN_REGISTRY } from "./registry.ts";
import type { IPlugin, IPluginFactory } from "./types.ts";

/**
 * Constructs plugin instances and owns namespace-bound storage resolution. **Total over the
 * registry**: it will build anything this build has registered.
 *
 * It deliberately holds no active set. Deciding which namespaces a profile may reach is a routing
 * concern one level up (`cli/program.ts`, from the set the composition root resolves) — §2.4 wants
 * absence to fail in *routing*, and a constructor that also adjudicates reachability would put that
 * decision below the layer that owns it. This type is a convenience for wiring `Storage` into a
 * definition, nothing more.
 */
export class PluginFactory implements IPluginFactory {
    readonly #storageFactory: IStorageFactory;

    constructor(storageFactory: IStorageFactory) {
        this.#storageFactory = storageFactory;
    }

    create(key: string): IPlugin {
        if (!isPluginKey(key)) {
            throw CoachError.unregisteredPlugin(key);
        }

        const { definition } = PLUGIN_REGISTRY[key];
        return {
            key,
            domain: definition.create(this.#storageFactory.create(key, definition.storeTables)),
        };
    }
}

