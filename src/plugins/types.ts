/**
 * The plugin seam (contract §2). A plugin contributes one {@link PluginDefinition}; the core turns
 * it into an {@link IPlugin} by resolving its namespace-bound storage and calling `commands`.
 *
 * Two deliberate refinements of the contract's written signatures:
 *
 * 1. **`PluginKey` is derived, not declared.** It is `keyof typeof PLUGIN_REGISTRY` (`registry.ts`),
 *    so a domain is added in exactly one place. §2.1 calls the declaration "the entire seam between
 *    a plugin and the core"; a hand-maintained union in a second file is a second seam that can
 *    desync from the first.
 *
 * 2. **A command's input is `unknown`, not a caller-chosen `Input`.** §2.2 writes
 *    `PluginCommand<Input, Output>`, but every verb reaches `execute` through the same
 *    `PluginCommands` lookup, so the dispatcher has no per-verb type to supply — argv (and, later,
 *    a Telegram message) has no compile-time shape. Declaring one anyway would not even be checked:
 *    `execute` is method syntax, so TypeScript is bivariant on the parameter and a command with a
 *    narrower `Input` is assignable regardless. The plugin narrows at the point it knows what it
 *    expects — the same rule, for the same reason, as reads in `infra/storage/types.ts`.
 */

import type { IStorageFactory, Storage } from "../infra/storage/index.ts";
import type { Envelope } from "../models/envelope.ts";
import type { PluginKey } from "./registry.ts";

export type { PluginKey };

/** A command on an already constructed plugin, plus optional cross-plugin enrichment metadata. */
export interface PluginCommand<Output = unknown> {
    readonly synergies: readonly PluginKey[];
    /**
     * `input` is unvalidated dispatcher data; the command narrows it.
     *
     * Declared as a function-typed **property**, not a method. Method syntax is bivariant in its
     * parameter even under `strict`, so `execute(input: unknown)` would still accept a command
     * declaring a narrower `input` — the unchecked cast this signature exists to prevent. A property
     * gets `strictFunctionTypes`, making that a compile error.
     */
    readonly execute: (input: unknown) => Envelope<Output> | Promise<Envelope<Output>>;
}

/**
 * Every plugin command, including the mandatory deterministic `summary` (§2.3) — required as a
 * named member, so omitting it is a type error while dispatch stays a uniform verb lookup.
 */
export type PluginCommands = Readonly<Record<string, PluginCommand>> & {
    readonly summary: PluginCommand;
};

/**
 * What a plugin contributes to the core: its namespace, its metric-store allowlist, and a builder
 * for its verbs. `storeTables` sits beside `commands` on one value because the factory needs the
 * allowlist *before* it can resolve the `Storage` that `commands` consumes.
 */
export interface PluginDefinition {
    readonly key: string;
    /** Declared ownership, the store's only boundary (§1.7). Empty for a non-quantitative domain. */
    readonly storeTables: readonly string[];
    commands(storage: Storage): PluginCommands;
}

/** A profile-bound plugin instance: one definition, resolved against one namespace's storage. */
export interface IPlugin {
    readonly key: PluginKey;
    readonly commands: PluginCommands;
}

/**
 * Construction only. It has no `keys()`: enumerating what a profile has active is not a factory's
 * question — see `registry.ts` (`registeredPluginKeys`, `resolveActivePlugins`).
 */
export interface IPluginFactory {
    create(key: string): IPlugin;
}

export type PluginFactoryBuilder = (storageFactory: IStorageFactory) => IPluginFactory;
