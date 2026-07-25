/**
 * The `CoachContext` — the per-invocation scope handed to every command, so no command
 * re-derives paths or reaches for `new Date()`. It wires `infra/` and `models/`; it owns
 * no implementations.
 */

import type { Clock } from "./infra/clock.ts";
import { systemClock } from "./infra/clock.ts";
import type { ProfileResolver } from "./infra/storage/scope.ts";
import type { IoSinks } from "./infra/io.ts";
import { StorageFactory, type IStorageFactory } from "./infra/storage/index.ts";

/** Process-level dependencies — real by default, swapped for fakes in tests. */
export interface CoachDeps {
    io: IoSinks;
    env?: NodeJS.ProcessEnv;
    clock?: Clock;
    /** The `data/` tree profiles are scoped under; a temp tree in tests. */
    dataRoot?: string;
    /** The shipped-defaults `policy/` tree; a temp tree in tests. */
    policyRoot?: string;
}

/** One validated profile plus the resolved process dependencies. */
export interface CoachContext {
    readonly profile: string;
    readonly env: NodeJS.ProcessEnv;
    readonly clock: Clock;
    readonly io: IoSinks;
    /**
     * Profile-bound path scoper. A resolved path can live only under `data/<profile>/`;
     * anything that would escape throws `PROFILE_SCOPE_VIOLATION`. The binding *is* the
     * isolation guarantee — a command cannot address another profile's tree.
     */
    readonly resolve: ProfileResolver;
    /**
     * The kind-typed stores for one plugin namespace, bound to this context's profile. This is
     * what a plugin gets instead of {@link CoachContext.resolve}, which stays for core commands
     * addressing paths no kind covers (contract §1.8).
     *
     * @throws `CoachError` / `PROFILE_SCOPE_VIOLATION` if `namespace` is not a safe single segment.
     */
    readonly storage: IStorageFactory;
}

/**
 * Binds `deps` to `profile`. The profile is validated *here*: `scoper(profile)` throws on an
 * unsafe name, so merely holding a `CoachContext` proves its scope is legal — no command
 * needs to re-validate.
 *
 * @throws `CoachError` / `PROFILE_SCOPE_VIOLATION` if `profile` is not a safe single segment.
 */
export function createContext(profile: string, deps: CoachDeps): CoachContext {
    const storage = new StorageFactory(profile, {
        dataRoot: deps.dataRoot,
        policyRoot: deps.policyRoot,
        clock: deps.clock,
    });
    return {
        profile,
        env: deps.env ?? process.env,
        clock: deps.clock ?? systemClock,
        io: deps.io,
        resolve: (...segments) => storage.resolve(...segments),
        storage,
    };
}
