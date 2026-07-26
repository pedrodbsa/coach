/**
 * **What this build can construct**, and the validation of **what a profile turns on** — two
 * different questions, kept apart from *how* a plugin is constructed (`factory.ts`).
 *
 * `PLUGIN_REGISTRY` is the one file a new domain edits: import its definition, add one entry.
 * `PluginKey` follows from the keys, so `PluginFactory` needs no case for it. This is §1.9's bar —
 * *a new plugin registers a namespace and declares its store tables, with zero core edits* — at its
 * honest floor. Zero is unreachable while the active set is chosen rather than discovered (§2.7
 * rejects self-registration: the set is a profile fact, and import-time side effects would let a
 * broken plugin break `coach core version`).
 *
 * The **active set** is a property of the profile, not of the build (§2.6), and not of the factory:
 * a factory constructs anything registered, and the decision of what a given athlete may reach sits
 * above it, with the caller that routes. `resolveActivePlugins` only validates a candidate set;
 * choosing it belongs to the composition root (`cli/coach.ts`), and from Chunk 13 to
 * `profile/core/plugins.yaml`.
 *
 * Nothing here runs plugin code or touches the filesystem (§2.5).
 */

import type { BoundVerb } from "../cli/binding.ts";
import { CORE_NAMESPACES } from "../commands/registry.ts";
import { CoachError } from "../models/error.ts";
import { stubCli } from "./stub/cli.ts";
import { stubPlugin } from "./stub/index.ts";
import type { PluginDefinition } from "./types.ts";

/**
 * One domain's two sides, collected. The binding is a **sibling** of the definition rather than a
 * field on it, so the dependency runs one way — `cli.ts` is compile-checked against `index.ts`, and
 * the engine side never imports the integration side. Registration is still one entry in one file.
 */
export interface RegisteredPlugin {
    readonly definition: PluginDefinition;
    readonly cli: Readonly<Record<string, BoundVerb>>;
}

export const PLUGIN_REGISTRY = {
    stub: { definition: stubPlugin, cli: stubCli },
} as const satisfies Record<string, RegisteredPlugin>;

/** A namespace this build knows how to construct. Which of them a *profile* activates is §2.6. */
export type PluginKey = keyof typeof PLUGIN_REGISTRY;

/**
 * The namespaces a profile may **not** switch off (amendments §1.2). One exemption from §2.6's "the
 * active set is a profile fact", and it earns it: a profile without the head coach has no mediator,
 * so it has no `decide`, no `plan`, and no way to weigh one domain against another. Its absence is a
 * startup error, not the benign routing gap §2.4 gives an ordinary absent plugin.
 *
 * `head` is **not** in `CORE_NAMESPACES`: it is the head coach *plugin's* namespace, reserved in the
 * sense that it is spoken for, not in the sense that a plugin may not take it. Putting it there
 * would reject the head coach's own registration in Chunk 7.
 */
export const MANDATORY_NAMESPACES: readonly string[] = Object.freeze(["head"]);

export function isPluginKey(key: string): key is PluginKey {
    return Object.hasOwn(PLUGIN_REGISTRY, key);
}

/** Every namespace this build can construct — the widest set a profile could activate. */
export function registeredPluginKeys(): readonly PluginKey[] {
    return Object.freeze(Object.keys(PLUGIN_REGISTRY).filter(isPluginKey));
}

/**
 * The verbs a namespace answers, and what one means. Both read the **static** binding: no plugin is
 * constructed, no profile is resolved and no file is touched, which is what lets a host build its
 * whole command tree before it knows whose data it is looking at (§2.5, amendment §1.7).
 */
export function pluginVerbs(key: PluginKey): readonly string[] {
    return Object.freeze(Object.keys(PLUGIN_REGISTRY[key].cli));
}

export function pluginVerb(key: PluginKey, verb: string): BoundVerb | undefined {
    const cli: Readonly<Record<string, BoundVerb>> = PLUGIN_REGISTRY[key].cli;
    return Object.hasOwn(cli, verb) ? cli[verb] : undefined;
}

/**
 * Validates one profile's chosen namespaces and freezes them into the active set. It does not
 * *decide* the set — the caller supplies it (§2.6).
 *
 * Anything wrong with that set is a **startup** error naming the offender (§2.5): by the time a bad
 * namespace reaches storage the binding is already wrong, which is the one failure the storage
 * binding cannot catch for itself.
 *
 * @throws {@link CoachError} — `DUPLICATE_NAMESPACE`, `RESERVED_NAMESPACE`, or
 * `UNREGISTERED_PLUGIN`. The parameter is `string[]` because from Chunk 13 this set arrives as
 * untrusted YAML.
 */
export function resolveActivePlugins(keys: readonly string[]): readonly PluginKey[] {
    const seen = new Set<string>();
    const active: PluginKey[] = [];

    for (const key of keys) {
        if (seen.has(key)) {
            throw CoachError.duplicateNamespace(key);
        }
        if (CORE_NAMESPACES.includes(key)) {
            throw CoachError.reservedNamespace(key);
        }
        if (!isPluginKey(key)) {
            throw CoachError.unregisteredPlugin(key);
        }
        seen.add(key);
        active.push(key);
    }

    assertMandatoryNamespaces(active);

    return Object.freeze(active);
}

/**
 * Enforces {@link MANDATORY_NAMESPACES} against one resolved set.
 *
 * **Latent until Chunk 7.** The rule is gated on what the build can actually construct: requiring a
 * namespace no `PluginDefinition` exists for would fail every call today for a plugin that has not
 * been written, which is noise rather than enforcement. The moment Chunk 7 registers `head`, the
 * check arms itself with no edit here — and until then `registeredPluginKeys()` does not list it, so
 * `coach head …` is the ordinary unknown-namespace gap rather than a phantom plugin.
 *
 * `registered` is a parameter rather than a read so the armed behaviour is provable now.
 *
 * @throws {@link CoachError} — `MISSING_MANDATORY_PLUGIN`, naming the namespace.
 */
export function assertMandatoryNamespaces(
    active: readonly string[],
    registered: readonly string[] = registeredPluginKeys(),
): void {
    for (const required of MANDATORY_NAMESPACES) {
        if (registered.includes(required) && !active.includes(required)) {
            throw CoachError.missingMandatoryPlugin(required);
        }
    }
}

