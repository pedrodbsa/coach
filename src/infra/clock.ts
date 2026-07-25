/**
 * Injectable clock. Time-dependent logic (briefs, drift-control windows) is built test-first and
 * must be deterministic, so `now` always comes from the context's clock, never ad-hoc `new Date()`.
 * Tests inject a frozen one. ("n8n owns the clock" is about *deployment* scheduling; the engine
 * still needs `now` injected here.)
 */
export interface Clock {
    now(): Date;
}

/** The real wall clock. Used everywhere except tests and deterministic fixtures. */
export const systemClock: Clock = {
    now: () => new Date(),
};
