import { describe, expect, it } from 'vitest';

import { createContext } from '../../src/context.ts';
import { coreVersion } from '../../src/commands/version.ts';

function context(profile = 'pedro') {
  return createContext(profile, {
    io: { stdout: { write: () => {} }, stderr: { write: () => {} } },
    env: {},
  });
}

describe('coreVersion', () => {
  it('returns version information for a profile-scoped context', () => {
    expect(coreVersion(context(), {})).toEqual({
      ok: true,
      data: {
        version: '0.1.0',
        schema_version: '0.2',
      },
      gaps: [],
      schema_version: '0.2',
    });
  });
});
