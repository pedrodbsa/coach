import { describe, expect, it } from 'vitest';

import { createContext, type CoachDeps } from '../src/context.ts';
import { coachError } from './support/errors.ts';

function deps(overrides: Partial<CoachDeps> = {}): CoachDeps {
  return {
    io: { stdout: { write: () => {} }, stderr: { write: () => {} } },
    env: {},
    ...overrides,
  };
}

describe('createContext', () => {
  it('rejects an unsafe profile at construction', () => {
    expect(() => createContext('../partner', deps())).toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
  });

  it('binds resolve to the profile scope', () => {
    const ctx = createContext('pedro', deps());

    expect(ctx.resolve('state', 'today.yaml').endsWith('/data/pedro/state/today.yaml')).toBe(true);
    expect(() => ctx.resolve('..', 'partner', 'x')).toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
  });

  it('scopes to an injected data root', () => {
    const ctx = createContext('pedro', deps({ dataRoot: '/tmp/coach-test-data' }));

    expect(ctx.resolve('logbook', '2026-07.yaml')).toBe(
      '/tmp/coach-test-data/pedro/logbook/2026-07.yaml',
    );
  });

  it('exposes the injected clock rather than the wall clock', () => {
    const fixed = new Date('2026-07-23T00:00:00.000Z');
    const ctx = createContext('pedro', deps({ clock: { now: () => fixed } }));

    expect(ctx.clock.now()).toBe(fixed);
  });
});
