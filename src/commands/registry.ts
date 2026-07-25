/**
 * The core command surface — the non-plugin half of what the engine dispatches, and the mirror of
 * `plugins/registry.ts`. A core verb is added here and nowhere else.
 *
 * `CORE_NAMESPACES` is spec §8's reserved list, which is wider than what is implemented: `brief`,
 * `sync`, `query`, `run` and `resume` arrive in later chunks but are reserved *now*, so a plugin
 * cannot take one in the meantime. Reserved-ness is the core's fact to own, so the plugin registry
 * imports it rather than keeping a second copy.
 */

import type { CoachCommand } from "../models/command.ts";
import { coreVersion } from "./version.ts";

/** Namespaces the core owns, implemented or not (spec §8). No plugin may claim one (§2.5). */
export const CORE_NAMESPACES: readonly string[] = Object.freeze([
    "core",
    "brief",
    "sync",
    "query",
    "run",
    "resume",
]);

/**
 * Input is `unknown` for the same reason it is on `PluginCommand`: the dispatcher receives argv, an
 * HTTP body or a chat message, none of which has a compile-time shape. The command narrows.
 */
export type CoreCommand = CoachCommand<unknown, unknown>;

/** Implemented core commands, by namespace then verb. A `Map` so no key can reach a prototype. */
export const CORE_COMMANDS: ReadonlyMap<string, ReadonlyMap<string, CoreCommand>> = new Map([
    ["core", new Map<string, CoreCommand>([["version", coreVersion]])],
]);
