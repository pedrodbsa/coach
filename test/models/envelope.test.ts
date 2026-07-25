import { describe, expect, it } from 'vitest';

import { makeEnvelope, SCHEMA_VERSION, type Gap } from '../../src/models/envelope.ts';

describe('makeEnvelope', () => {
  it('serializes to valid JSON with all four keys present on a clean success', () => {
    const envelope = makeEnvelope({ hello: 'world' });
    const parsed = JSON.parse(JSON.stringify(envelope)) as Record<string, unknown>;

    expect(parsed).toEqual({
      ok: true,
      data: { hello: 'world' },
      gaps: [],
      schema_version: SCHEMA_VERSION,
    });
  });

  it('round-trips a gap with exactly { field, reason, action }', () => {
    const gap: Gap = {
      field: 'nutrition.calories',
      reason: 'DSW endpoint returned no rows for the date',
      action: 'ask the athlete for a manual log entry',
    };

    const envelope = makeEnvelope<number>(null, [gap]);
    const roundTripped = JSON.parse(JSON.stringify(envelope)) as { gaps: Gap[] };

    expect(roundTripped.gaps).toEqual([gap]);
    expect(Object.keys(roundTripped.gaps[0]!)).toEqual(['field', 'reason', 'action']);
  });

  it('allows null data to coexist with a populated gaps array (missing != zero)', () => {
    const gap: Gap = { field: 'x', reason: 'not synced', action: 'retry sync' };
    const envelope = makeEnvelope<number>(null, [gap]);

    expect(envelope.data).toBeNull();
    expect(envelope.data).not.toBe(0);
    expect(envelope.gaps).toHaveLength(1);
  });

  it('sets ok: false whenever gaps is non-empty, regardless of data', () => {
    const gap: Gap = { field: 'x', reason: 'r', action: 'a' };

    expect(makeEnvelope('present', [gap]).ok).toBe(false);
    expect(makeEnvelope(null, [gap]).ok).toBe(false);
  });

  it('sets ok: true only when gaps is empty', () => {
    expect(makeEnvelope('present').ok).toBe(true);
    expect(makeEnvelope(null).ok).toBe(true);
  });

  it('pins schema_version to the shared constant', () => {
    expect(makeEnvelope(null).schema_version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe('0.2');
  });
});
