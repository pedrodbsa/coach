/**
 * The plugin seam, **engine side** (contract §2, as superseded by the 2026-07-25 plugin-seam
 * amendment §1). A plugin is domain logic: typed functions taking typed input and returning domain
 * results. Nothing here knows a CLI exists — no argv, no `Envelope`, no exit code. How a domain
 * function is reached from a command line is the co-located binding's business (`cli.ts` beside each
 * plugin's `index.ts`, typed by `cli/binding.ts`, collected by `registry.ts`).
 *
 * Two refinements of the contract's written signatures survive from Chunk 2:
 *
 * 1. **`PluginKey` is derived, not declared.** It is `keyof typeof PLUGIN_REGISTRY` (`registry.ts`),
 *    so a domain is added in exactly one place. §2.1 calls the declaration "the entire seam between
 *    a plugin and the core"; a hand-maintained union in a second file is a second seam that can
 *    desync from the first.
 *
 * 2. **A domain function's input is *its own*, not `unknown`.** Chunk 2's `execute(input: unknown)`
 *    existed only because argv has no compile-time shape. The binding now narrows, so the function
 *    declares what it needs and the cast has one home instead of one per plugin.
 */

import type { IStorageFactory, Storage } from "../infra/storage/index.ts";
import type { Gap } from "../models/envelope.ts";
import type { PluginKey } from "./registry.ts";

export type { PluginKey };

/**
 * A value a summary may publish as a fact: JSON scalars and small fixed-shape records.
 *
 * It cannot exclude prose — a policy-defined enum *is* a string — so "no fact is a bare sentence" is
 * a build-time check over emitted facts (amendment §3.7), owned by Chunk 4, not a type.
 */
export type JsonFact =
    | string
    | number
    | boolean
    | null
    | readonly JsonFact[]
    | { readonly [key: string]: JsonFact };

/**
 * A result that can degrade. Declaring `extends DomainResult` is how a domain result says so;
 * results that cannot degrade still extend it and simply never populate `gaps`.
 *
 * The gaps stay on the result. `engine.invoke` **copies** them to the envelope rather than moving
 * them: Chunk 4's brief keys each domain's own gaps by namespace to say which domain could not
 * answer, and the envelope needs them at the top level to drive `ok` and the exit code.
 */
export interface DomainResult {
    readonly gaps?: readonly Gap[];
}

/**
 * The deterministic `summary` (contract §3.2, amendment §3.2) — the only thing the head coach reads
 * from a domain, and therefore the one shape that has to stay context-lean.
 */
export interface DomainSummary extends DomainResult {
    readonly namespace: string;
    /** Bounded, prose-free. Values are JSON scalars or small fixed-shape records. */
    readonly facts: Readonly<Record<string, JsonFact>>;
    /**
     * Agent-readable context: the athlete's voice, carried by the domain. Never parsed, never
     * computed with, never a fact's only home. **Required and may be empty** — optional would let a
     * domain forget it exists. Chunks 5–6 and 9 populate it; the shape is all this task fixes.
     */
    readonly observations: readonly string[];
    readonly gaps: readonly Gap[];
}

/**
 * Any domain function, as the dispatcher holds one: input in, a domain result out.
 *
 * `input: unknown` is the widest a heterogeneous table can share. It is method syntax on
 * {@link DomainPlugin} deliberately — bivariance is what lets `summary(input: { date: IsoDate })`
 * live in the table — and it is safe here precisely because the binding, not this type, is what
 * proves the value handed over has that method's declared shape.
 */
export type DomainFunction = (input: unknown) => DomainResult | Promise<DomainResult>;

/**
 * The engine side of a plugin: its domain functions, one of them mandatory.
 *
 * A **type alias**, not an interface, so the dispatcher can address a constructed plugin by the
 * method name its binding proved (TypeScript grants implicit index signatures to aliases of object
 * types, and to interfaces never).
 */
export type DomainPlugin = {
    /** Mandatory (contract §2.3), as a required *method*: omitting it is a compile error. */
    summary(input: unknown): DomainSummary | Promise<DomainSummary>;
};

/**
 * What a plugin contributes to the core: its namespace, its metric-store allowlist, and a builder
 * for its engine side. `storeTables` sits beside `create` on one value because the factory needs the
 * allowlist *before* it can resolve the `Storage` that `create` consumes.
 */
export interface PluginDefinition<P extends DomainPlugin = DomainPlugin> {
    readonly key: string;
    /** Declared ownership, the store's only boundary (§1.7). Empty for a non-quantitative domain. */
    readonly storeTables: readonly string[];
    /**
     * Which other domains this one enriches (contract §5, amendment §2) — domain metadata, not argv
     * metadata, which is why it is here rather than on a verb. **It has no consumer anywhere**:
     * hard edges live on `decision.prescribes[].depends_on`, so Chunk 7.3 must use it or delete it.
     */
    readonly synergies?: readonly PluginKey[];
    create(storage: Storage): P;
}

/** A profile-bound plugin instance: one definition, resolved against one namespace's storage. */
export interface IPlugin {
    readonly key: PluginKey;
    /** The constructed engine side. Its methods are reached through the binding, never by guess. */
    readonly domain: DomainPlugin;
}

/**
 * Construction only. It has no `keys()`: enumerating what a profile has active is not a factory's
 * question — see `registry.ts` (`registeredPluginKeys`, `resolveActivePlugins`).
 */
export interface IPluginFactory {
    create(key: string): IPlugin;
}

export type PluginFactoryBuilder = (storageFactory: IStorageFactory) => IPluginFactory;
