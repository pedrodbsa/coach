/**
 * `CoachEngine` — **the system**, independent of how it is reached. Spec §8 calls the CLI "the
 * engine's interface" and the library behind it "framework-independent"; this is that library's
 * entry point, and `cli/` is one adapter over it. Reaching the same behaviour from somewhere else
 * means constructing this class — with no CLI in the picture — and nothing more.
 *
 * That is a statement about *layering*, not about packaging: this repo publishes no library and
 * §13 keeps the CLI the one interface into the deployment ("n8n custom nodes exec the CLI; they do
 * not import the library"). The boundary exists so the CLI stays replaceable and testable, not so a
 * second consumer can be shipped.
 *
 * What the engine owns, because no host should decide it:
 *
 * - **The active plugin set.** Validated once, at construction (§2.5 wants a *startup* error), and
 *   from Chunk 13 sourced from the profile's own selection (§2.6).
 * - **Profile scoping.** Every invocation builds a fresh {@link CoachContext}, so no request can
 *   observe or reach another profile's tree.
 * - **Dispatch.** Core namespaces from `commands/registry.ts`, plugin namespaces through the
 *   factory. A host routes; it never constructs a plugin itself.
 * - **The envelope.** {@link CoachEngine.invoke} *never throws* — every outcome, including an
 *   unknown namespace or a command that blew up, is one `{ ok, data, gaps, schema_version }`. A host
 *   only has to publish it.
 *
 * What the engine deliberately does **not** own: which profile a request is for. Resolving that from
 * a `--profile` flag, a `chat_id`, or a session cookie is host-specific, so `invoke` demands a
 * profile and validates it, but never guesses one.
 */

import { CORE_COMMANDS } from "./commands/registry.ts";
import { createContext, type CoachDeps } from "./context.ts";
import type { Clock } from "./infra/clock.ts";
import type { IoSinks } from "./infra/io.ts";
import { makeEnvelope, makeGap, type Envelope } from "./models/envelope.ts";
import { CoachError } from "./models/error.ts";
import {
    PluginFactory,
    registeredPluginKeys,
    resolveActivePlugins,
    type PluginFactoryBuilder,
    type PluginKey,
} from "./plugins/index.ts";

export interface CoachEngineOptions {
    /**
     * Namespaces this deployment activates, defaulting to every registered plugin — §2.6's Chunk 2
     * position ("one profile, everything on"). Chunk 13 passes the profile's own selection.
     */
    readonly activePlugins?: readonly string[];
    /** Diagnostics sink. Silent by default: an embedded engine must not write to the host's console. */
    readonly io?: IoSinks;
    readonly env?: NodeJS.ProcessEnv;
    readonly clock?: Clock;
    /** The `data/` tree profiles are scoped under; a temp tree in tests. */
    readonly dataRoot?: string;
    /** The shipped-defaults `policy/` tree; a temp tree in tests. */
    readonly policyRoot?: string;
    /** Seam for tests and alternative wirings; defaults to the registry-backed factory. */
    readonly buildPluginFactory?: PluginFactoryBuilder;
}

/**
 * One transport-neutral invocation. A CLI builds this from argv, a bot from a message, an HTTP route
 * from a path plus body — the engine cannot tell which, and that is the point.
 */
export interface CoachRequest {
    readonly namespace: string;
    readonly verb: string;
    readonly profile: string;
    /** Unvalidated host data. The command narrows it. */
    readonly input?: unknown;
}

/** The command surface a host needs to route, narrower than the whole engine. */
export interface CommandSurface {
    /** Every namespace this engine answers — core plus the active plugins. */
    namespaces(): readonly string[];
    /** Verbs known without a profile. Empty for a plugin namespace, whose verbs need construction. */
    coreVerbs(namespace: string): readonly string[];
}

const SILENT_IO: IoSinks = Object.freeze({
    stdout: { write: () => {} },
    stderr: { write: () => {} },
});

export class CoachEngine implements CommandSurface {
    readonly #activePlugins: readonly PluginKey[];
    readonly #deps: CoachDeps;
    readonly #buildPluginFactory: PluginFactoryBuilder;

    /**
     * @throws {@link CoachError} when `activePlugins` contains a duplicate, a core-reserved
     * namespace, or one no plugin is registered under. Construction is the one place throwing is
     * right: a misconfigured deployment should fail at startup, not per request.
     */
    constructor(options: CoachEngineOptions = {}) {
        this.#activePlugins = resolveActivePlugins(options.activePlugins ?? registeredPluginKeys());
        this.#deps = {
            io: options.io ?? SILENT_IO,
            env: options.env,
            clock: options.clock,
            dataRoot: options.dataRoot,
            policyRoot: options.policyRoot,
        };
        this.#buildPluginFactory = options.buildPluginFactory ?? ((storage) => new PluginFactory(storage));
    }

    /** The active plugin namespaces, in the order the caller supplied them. */
    activePlugins(): readonly PluginKey[] {
        return this.#activePlugins;
    }

    namespaces(): readonly string[] {
        return Object.freeze([...CORE_COMMANDS.keys(), ...this.#activePlugins]);
    }

    coreVerbs(namespace: string): readonly string[] {
        return Object.freeze([...(CORE_COMMANDS.get(namespace)?.keys() ?? [])]);
    }

    /**
     * Runs one request in a freshly scoped context. Never throws — a failure is a `gap`, so a host
     * has exactly one shape to publish and stdout can stay a single well-formed envelope.
     */
    async invoke(request: CoachRequest): Promise<Envelope<unknown>> {
        try {
            // Validates the profile name; merely holding the context proves its scope is legal.
            const ctx = createContext(request.profile, this.#deps);

            const core = CORE_COMMANDS.get(request.namespace);
            if (core !== undefined) {
                const command = core.get(request.verb);
                if (command === undefined) {
                    throw CoachError.unknownCommand(request.namespace, request.verb);
                }
                return await command(ctx, request.input);
            }

            // Re-checked here rather than trusted from the host: routing is a host's convenience,
            // reachability is the engine's guarantee (§2.4).
            if (!this.#activePlugins.some((active) => active === request.namespace)) {
                throw CoachError.unknownNamespace(request.namespace, this.namespaces());
            }

            const plugin = this.#buildPluginFactory(ctx.storage).create(request.namespace);
            const command = Object.hasOwn(plugin.commands, request.verb) ? plugin.commands[request.verb] : undefined;
            if (command === undefined) {
                throw CoachError.unknownCommand(request.namespace, request.verb);
            }

            return await command.execute(request.input);
        } catch (error: unknown) {
            return makeEnvelope(null, [makeGap(error)]);
        }
    }
}
