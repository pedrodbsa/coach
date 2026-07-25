import { describe, expect, it } from 'vitest';

import { PROFILE_ENV_VAR, resolveProfile } from '../../src/models/profile.ts';
import { coachError } from '../support/errors.ts';

describe('resolveProfile — explicit flag wins, COACH_PROFILE is the fallback', () => {
  it('returns the explicit profile when one is given', () => {
    expect(resolveProfile('pedro', {})).toBe('pedro');
  });

  it('falls back to the environment variable when no explicit profile is given', () => {
    expect(resolveProfile(undefined, { [PROFILE_ENV_VAR]: 'pedro' })).toBe('pedro');
  });

  it('lets an explicit profile win over a set environment variable', () => {
    expect(resolveProfile('pedro', { [PROFILE_ENV_VAR]: 'partner' })).toBe('pedro');
  });

  it('trims surrounding whitespace on the environment value', () => {
    expect(resolveProfile(undefined, { [PROFILE_ENV_VAR]: '  pedro\n' })).toBe('pedro');
  });

  it('throws when neither an explicit profile nor the environment variable is set', () => {
    expect(() => resolveProfile(undefined, {})).toThrow(/no profile/i);
    expect(() => resolveProfile(undefined, {})).toThrow(new RegExp(PROFILE_ENV_VAR));
  });

  it('treats a blank or whitespace-only environment value as unset', () => {
    expect(() => resolveProfile(undefined, { [PROFILE_ENV_VAR]: '' })).toThrow(/no profile/i);
    expect(() => resolveProfile(undefined, { [PROFILE_ENV_VAR]: '   ' })).toThrow(/no profile/i);
  });

  it('validates the environment value with the same rules as an explicit profile', () => {
    expect(() => resolveProfile(undefined, { [PROFILE_ENV_VAR]: '../partner' })).toThrow(
      coachError("PROFILE_SCOPE_VIOLATION"),
    );
    expect(() => resolveProfile(undefined, { [PROFILE_ENV_VAR]: 'a/b' })).toThrow(
      coachError("PROFILE_SCOPE_VIOLATION"),
    );
  });

  it('does not fall back to the environment when the explicit profile is malformed', () => {
    // A typo'd flag must be a hard error, never a silent switch to the ambient profile.
    expect(() => resolveProfile('../oops', { [PROFILE_ENV_VAR]: 'pedro' })).toThrow(
      coachError("PROFILE_SCOPE_VIOLATION"),
    );
    expect(() => resolveProfile('', { [PROFILE_ENV_VAR]: 'pedro' })).toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
  });
});
