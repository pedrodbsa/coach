/**
 * A profile *name* — the identity half of profile isolation, pure and free of filesystem
 * concern: "is this a legal name?" and "which profile is active?". Turning a name into a scoped
 * path is the adapter's job (`infra/storage/scope.ts`), which reuses {@link assertValidProfile}
 * and raises the same `PROFILE_SCOPE_VIOLATION`.
 */

import { CoachError } from "./error.ts";

/** A single, literal path segment — no traversal, no separators, no NUL. */
export function assertValidProfile(profile: string): void {
    if (typeof profile !== "string" || profile.length === 0) {
        throw CoachError.profileScope("profile must be a non-empty string");
    }
    if (profile === "." || profile === "..") {
        throw CoachError.profileScope(`profile "${profile}" is a relative reference, not a name`);
    }
    if (/[/\\]/.test(profile)) {
        throw CoachError.profileScope(`profile "${profile}" must not contain a path separator`);
    }
    if (profile.includes("\0")) {
        throw CoachError.profileScope("profile must not contain a NUL byte");
    }
}

/** Environment variable consulted for the active profile when no explicit one is given. */
export const PROFILE_ENV_VAR = "COACH_PROFILE";

/**
 * Resolves the active profile from `--profile` or, only when absent, `COACH_PROFILE`.
 *
 * Isolation-safe precedence: an explicit flag always wins and is never overridden by the
 * environment, and a malformed flag is a hard error rather than a reason to fall back to an
 * ambient profile — falling back could quietly act on the wrong scope. Never defaulted silently.
 *
 * @throws {@link CoachError} `NO_PROFILE_SELECTED` when neither source yields a profile, or
 * `PROFILE_SCOPE_VIOLATION` when the chosen name is not a safe single segment.
 */
export function resolveProfile(
    explicit: string | undefined,
    env: NodeJS.ProcessEnv = process.env,
): string {
    if (explicit !== undefined) {
        assertValidProfile(explicit);
        return explicit;
    }

    const fromEnv = (env[PROFILE_ENV_VAR] ?? "").trim();
    if (fromEnv === "") {
        throw CoachError.noProfileSelected(PROFILE_ENV_VAR);
    }

    assertValidProfile(fromEnv);
    return fromEnv;
}
