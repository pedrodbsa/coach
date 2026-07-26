/**
 * The **CLI binding**: how a verb on the command line reaches a *method* on a plugin's engine side
 * (amendment §1.1–§1.4). This is the integration side of the seam and the only layer that knows argv
 * exists — task 3.0 gives a verb Commander's own flag grammar here, which is allowed in `src/cli/`
 * and in a plugin's `cli.ts`, and nowhere else.
 *
 * A binding *instance* ships with its plugin (`plugins/<domain>/cli.ts`), so adding a domain still
 * edits exactly one core file — `PLUGIN_REGISTRY` (contract §1.9). `plugins/registry.ts` referencing
 * these types is a **leaf-type dependency, not a behavioural one**: a binding is static data, so
 * collecting one constructs no plugin, resolves no profile and touches no filesystem (§2.5).
 *
 * The point of the generics below is that a binding is **compile-checked against its plugin**. Two
 * files describing one plugin desync the first time somebody renames a method, and a convention will
 * not catch it — so `method` may only name a method the plugin has, and `narrow` may only build
 * *that* method's input.
 */

import type { DomainPlugin } from "../plugins/types.ts";

/** The unvalidated bag a host hands a verb — Commander's parsed argv today. The binding narrows it. */
export type RawInput = unknown;

/**
 * The names of `P`'s domain functions — the only strings a verb may name.
 *
 * The predicate is `(...args: never[]) => unknown` rather than `DomainFunction` so that a method
 * declaring its own narrow input still counts; matching against a fixed parameter type would quietly
 * drop exactly the methods this seam exists to allow.
 */
export type MethodOf<P> = {
    [K in keyof P]-?: P[K] extends (...args: never[]) => unknown ? K : never;
}[keyof P];

/** The input one domain function declares. A function that takes nothing accepts anything. */
export type InputOf<F> = F extends (input: infer I) => unknown ? I : never;

/**
 * One verb. Distributed over the method names so `narrow`'s return type is tied to the *same* method
 * that `method` names: binding `summary` to a narrowing that builds `progress`'s input is a compile
 * error rather than a runtime surprise. `narrow` is a property, not a method, so it is checked
 * strictly — the bivariance {@link DomainPlugin} relies on stops here, where the cast actually lands.
 */
export type VerbBinding<P extends DomainPlugin> = {
    [M in MethodOf<P>]: {
        readonly method: M;
        readonly narrow: (raw: RawInput) => InputOf<P[M]>;
    };
}[MethodOf<P>];

/** A plugin's verb table: what `coach <namespace> <verb>` means, and nothing about what it accepts. */
export type CliBinding<P extends DomainPlugin> = Readonly<Record<string, VerbBinding<P>>>;

/**
 * A binding as the **dispatcher** sees it, with the plugin type erased. The check has already
 * happened where the two files meet; the registry only has to carry the result.
 */
export interface BoundVerb {
    readonly method: string;
    readonly narrow: (raw: RawInput) => unknown;
}
