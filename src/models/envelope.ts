/**
 * The output envelope every `coach` command returns (spec §8, plan Global Constraints):
 * `{ ok, data, gaps, schema_version }`, fixed here and reused unchanged by every later command.
 *
 * Both shapes are built through the two constructors below, never by literal — that is what keeps
 * `ok` derived and a gap's three fields from drifting to two.
 */

import { CoachError } from "./error.ts";

/** The pinned schema/policy version. A mismatch elsewhere in the engine is a hard failure. */
export const SCHEMA_VERSION = "0.2";

/** A first-class gap: missing is `null` plus a reason — never a coerced `0` or empty value. */
export interface Gap {
    field: string;
    reason: string;
    action: string;
}

export interface Envelope<T> {
    ok: boolean;
    data: T | null;
    gaps: Gap[];
    schema_version: string;
}

/**
 * Builds an envelope. `ok` is derived, never chosen by the caller: `true` iff `gaps` is empty,
 * regardless of `data`. Enforced here rather than left to each call site.
 */
export function makeEnvelope<T>(data: T | null, gaps: Gap[] = []): Envelope<T> {
    return {
        ok: gaps.length === 0,
        data,
        gaps,
        schema_version: SCHEMA_VERSION,
    };
}

/**
 * Folds any failure into the single `command` gap shape, so a host's own failures (a malformed argv,
 * a bad HTTP body) reach the caller in exactly the envelope the engine uses — one shape on the wire,
 * whatever went wrong.
 *
 * A {@link CoachError} that named its own remedy keeps it; anything else — including a native error
 * from a library — falls back to `action`. No branching on error type: that is what the optional
 * field is for.
 */
export function makeGap(error: unknown, action = "Correct the command arguments and retry."): Gap {
    return {
        field: "command",
        reason: error instanceof Error ? error.message : String(error),
        action: (error instanceof CoachError ? error.action : undefined) ?? action,
    };
}
