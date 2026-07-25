/**
 * Profile-scoping path helper — the single chokepoint for the isolation invariant (spec §4, §10):
 * a resolved path may live *only* inside `data/<profile>/` and never cross, to a sibling or out
 * of the data tree. Errs toward throwing — any path it cannot prove contained is a hard failure.
 *
 * Two layers: (1) **lexical** — `path.resolve` collapses `.`/`..` and lets an absolute segment
 * discard the base, so the result must sit under the profile root (catches `../partner/x`);
 * (2) **symlink** — realpath the data root, profile root, and the candidate's longest existing
 * prefix, requiring the profile root to still be the named child of the canonical data root
 * before checking the candidate, so neither a root alias nor a descendant symlink can cross.
 * A not-yet-created tail resolves cleanly. The name rule lives in `models/profile.ts`; this adapter
 * reuses it and raises the same `PROFILE_SCOPE_VIOLATION`, since dependencies point inward.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CoachError } from "../../models/error.ts";
import { assertValidProfile } from "../../models/profile.ts";

/** Repo root: three levels up, whether running from `src/…` (tests) or `dist/…` (build). */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Absolute path to the `data/` tree, the root every profile's own data lives under. */
export const DATA_ROOT = path.resolve(REPO_ROOT, "data");

/** The shared `policy/` tree — the shipped-defaults half of "effective policy = defaults ⊕ overrides". */
export const POLICY_ROOT = path.resolve(REPO_ROOT, "policy");

/** A scoper: turns `(profile, ...segments)` into a contained absolute path, or throws. */
export type ProfileScoper = (profile: string, ...segments: string[]) => string;

/** A scoper already bound to one profile: `(...segments)` → contained absolute path. */
export type ProfileResolver = (...segments: string[]) => string;

/** Resolves one namespaced shipped-policy document below a builder-authored `policy/` tree. */
export type PolicyResolver = (namespace: string, ...segments: string[]) => string;

/** Builds a policy resolver rooted at {@link POLICY_ROOT} in production, a temp tree in tests. */
export function createPolicyResolver(policyRoot: string): PolicyResolver {
    return function resolveInPolicyRoot(namespace: string, ...segments: string[]): string {
        assertValidProfile(namespace);
        for (const segment of segments) {
            assertValidProfile(segment);
        }

        // Unlike profile data, this builder-authored, runtime-read-only tree has no user-owned
        // per-profile root to defend through symlink checks; safe segments still reject traversal.
        return path.join(policyRoot, namespace, ...segments);
    };
}

/** Resolves below the repo's shipped `policy/` tree — the defaults half of effective policy. */
export const resolveInPolicy: PolicyResolver = createPolicyResolver(POLICY_ROOT);

/**
 * Asserts `candidate` is `root` or lives beneath it. `path.relative` yields a leading `..` (or,
 * on a foreign drive, an absolute path) exactly when it does not.
 */
function assertWithin(root: string, candidate: string, detail: string): void {
    const rel = path.relative(root, candidate);
    if (rel !== "" && (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel))) {
        throw CoachError.profileScope(
            `path escapes the profile root: ${detail} resolved to "${candidate}", outside "${root}"`,
        );
    }
}

function isEnoent(err: unknown): boolean {
    return err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT";
}

/**
 * `realpath` of the longest existing prefix of `target`, with any missing tail re-appended
 * lexically — a not-yet-created tail (or broken link) is left as-is, not treated as an escape.
 */
function realpathBestEffort(target: string): string {
    const tail: string[] = [];
    let current = target;

    for (;;) {
        try {
            const real = fs.realpathSync(current);
            return tail.length ? path.join(real, ...tail) : real;
        } catch (err) {
            if (!isEnoent(err)) {
                throw err;
            }
            const parent = path.dirname(current);
            if (parent === current) {
                return tail.length ? path.join(current, ...tail) : current;
            }
            tail.unshift(path.basename(current));
            current = parent;
        }
    }
}

/** Builds a scoper bound to a `data/` root — {@link DATA_ROOT} by default, a temp tree in tests. */
export function createProfileScoper(dataRoot: string): ProfileScoper {
    return function resolveInProfile(profile: string, ...segments: string[]): string {
        assertValidProfile(profile);

        const profileRoot = path.resolve(dataRoot, profile);
        const candidate = path.resolve(profileRoot, ...segments);

        // Layer 1: lexical containment (traversal, absolute escapes).
        assertWithin(profileRoot, candidate, segments.join("/") || "<profile root>");

        // Layer 2: anchor the resolved profile root to the named child of the resolved data root.
        // Checking only candidate vs. profileRoot would trust a profileRoot symlink aliasing a sibling.
        const realDataRoot = realpathBestEffort(path.resolve(dataRoot));
        const realProfileRoot = realpathBestEffort(profileRoot);
        const expectedProfileRoot = path.resolve(realDataRoot, profile);

        assertWithin(realDataRoot, realProfileRoot, `<profile root "${profile}">`);
        if (path.relative(expectedProfileRoot, realProfileRoot) !== "") {
            throw CoachError.profileScope(
                `profile root "${profileRoot}" resolved to "${realProfileRoot}", expected "${expectedProfileRoot}"`,
            );
        }

        // Once the root itself is trusted, reject symlinks below it that escape.
        assertWithin(
            realProfileRoot,
            realpathBestEffort(candidate),
            segments.join("/") || "<profile root>",
        );

        return candidate;
    };
}
