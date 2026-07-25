import { expect } from "vitest";

import type { CoachErrorCode } from "../../src/models/error.ts";

/**
 * Matches a thrown or rejected value by its {@link CoachErrorCode} — what `toThrow(SomeError)` used
 * to give for free when every failure had its own class. Asserting the code, not the class, is the
 * point: the code is the part of the contract a caller can act on.
 *
 * Works for both `expect(fn).toThrow(...)` and `await expect(promise).rejects.toThrow(...)`.
 */
export function coachError(code: CoachErrorCode) {
    return expect.objectContaining({ code });
}
