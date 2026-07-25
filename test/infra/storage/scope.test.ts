import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CoachError } from '../../../src/models/error.ts';
import { coachError } from '../../support/errors.ts';
import {
  createProfileScoper,
  DATA_ROOT,
  POLICY_ROOT,
  resolveInPolicy,
} from '../../../src/infra/storage/scope.ts';

/**
 * This helper is the one code-enforced data boundary in the system (spec §4, §10).
 * The suite is deliberately adversarial: a single path that escapes `data/<profile>/`
 * is a hard-invariant breach, so every escape vector must throw rather than resolve.
 *
 * The production scoper is always constructed (never a shared singleton), so these cases
 * bind one to the repo's real `data/` root; the symlink suite binds one to a temp tree.
 */
const resolveInProfile = createProfileScoper(DATA_ROOT);

describe('createProfileScoper — legal paths (rooted at the repo data tree)', () => {
  it('resolves nested segments to a normalized absolute path under data/<profile>/', () => {
    const resolved = resolveInProfile('pedro', 'store', 'metrics.db');

    expect(path.isAbsolute(resolved)).toBe(true);
    expect(resolved).toBe(path.join(DATA_ROOT, 'pedro', 'store', 'metrics.db'));
  });

  it('returns the profile root itself when given no segments', () => {
    expect(resolveInProfile('pedro')).toBe(path.join(DATA_ROOT, 'pedro'));
  });

  it('normalizes "." and interior ".." that stay inside the profile root', () => {
    expect(resolveInProfile('pedro', 'a', '.', 'b')).toBe(
      path.join(DATA_ROOT, 'pedro', 'a', 'b'),
    );
    expect(resolveInProfile('pedro', 'a', '..', 'b')).toBe(
      path.join(DATA_ROOT, 'pedro', 'b'),
    );
  });

  it('scopes a different profile to its own subtree, never crossing', () => {
    expect(resolveInProfile('partner', 'state', 'x.yaml')).toBe(
      path.join(DATA_ROOT, 'partner', 'state', 'x.yaml'),
    );
  });
});

describe('createProfileScoper — traversal & absolute escapes (must throw)', () => {
  const escapes: Array<[string, string[]]> = [
    ['single ".." out of the profile', ['..', 'partner', 'x']],
    ['".." combined into the first segment', ['../partner/x']],
    ['bare ".." landing on the data root', ['..']],
    ['stacked ".." climbing past the data root', ['a', '..', '..', 'partner']],
    ['absolute path pointing elsewhere', ['/etc/passwd']],
    ['absolute path to another profile root', [path.join(DATA_ROOT, 'partner', 'x')]],
  ];

  for (const [label, segments] of escapes) {
    it(`throws on ${label}`, () => {
      expect(() => resolveInProfile('pedro', ...segments)).toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
    });
  }

  it('tags the escape error with a distinguishable code', () => {
    try {
      resolveInProfile('pedro', '../partner/x');
      expect.unreachable('expected a scope violation');
    } catch (err) {
      expect(err).toBeInstanceOf(CoachError);
      expect((err as CoachError).code).toBe('PROFILE_SCOPE_VIOLATION');
    }
  });
});

describe('createProfileScoper — crafted profile argument (must throw before resolving)', () => {
  const badProfiles: Array<[string, string]> = [
    ['empty', ''],
    ['dot', '.'],
    ['dot-dot', '..'],
    ['forward-slash separator', 'a/b'],
    ['back-slash separator', 'a\\b'],
    ['traversal disguised as a profile', 'pedro/../partner'],
    ['leading slash', '/pedro'],
    ['NUL byte', 'a\0b'],
  ];

  for (const [label, profile] of badProfiles) {
    it(`throws on a ${label} profile`, () => {
      expect(() => resolveInProfile(profile, 'x')).toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
    });
  }
});

describe('createProfileScoper — symlink escapes (resolved to the extent possible)', () => {
  let dataRoot: string;
  let externalRoot: string;
  let scoped: (profile: string, ...segments: string[]) => string;

  beforeAll(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'coach-scope-data-'));
    externalRoot = mkdtempSync(path.join(tmpdir(), 'coach-scope-out-'));
    scoped = createProfileScoper(dataRoot);

    mkdirSync(path.join(dataRoot, 'pedro', 'store'), { recursive: true });
    mkdirSync(path.join(dataRoot, 'partner'), { recursive: true });

    // A link inside pedro that redirects to a sibling profile — cross-profile escape.
    symlinkSync(path.join(dataRoot, 'partner'), path.join(dataRoot, 'pedro', 'to-partner'));
    // A link inside pedro that redirects fully outside the data tree.
    symlinkSync(externalRoot, path.join(dataRoot, 'pedro', 'to-outside'));
    // A link that stays within pedro — must remain legal.
    symlinkSync(path.join(dataRoot, 'pedro', 'store'), path.join(dataRoot, 'pedro', 'to-store'));
    // Profile roots themselves must never be aliases for another profile or external tree.
    symlinkSync(path.join(dataRoot, 'partner'), path.join(dataRoot, 'linked-partner'));
    symlinkSync(externalRoot, path.join(dataRoot, 'linked-outside'));
  });

  afterAll(() => {
    rmSync(dataRoot, { recursive: true, force: true });
    rmSync(externalRoot, { recursive: true, force: true });
  });

  it('throws when a symlink component redirects to another profile', () => {
    expect(() => scoped('pedro', 'to-partner', 'secret.yaml')).toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
  });

  it('throws when a symlink component redirects outside the data tree', () => {
    expect(() => scoped('pedro', 'to-outside', 'secret.yaml')).toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
  });

  it('throws when the profile root is a symlink to another profile', () => {
    expect(() => scoped('linked-partner', 'secret.yaml')).toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
  });

  it('throws when the profile root is a symlink outside the data tree', () => {
    expect(() => scoped('linked-outside', 'secret.yaml')).toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
  });

  it('allows a symlink that stays within the same profile', () => {
    const resolved = scoped('pedro', 'to-store', 'metrics.db');
    expect(existsSync(path.dirname(resolved))).toBe(true);
    expect(resolved.startsWith(path.join(dataRoot, 'pedro') + path.sep)).toBe(true);
  });

  it('resolves a legal path in a not-yet-created subtree without throwing', () => {
    expect(scoped('pedro', 'history', '2026', '07.yaml')).toBe(
      path.join(dataRoot, 'pedro', 'history', '2026', '07.yaml'),
    );
  });
});

describe('resolveInPolicy — shipped defaults are traversal-safe', () => {
  it('resolves a namespaced document beneath the shipped policy root', () => {
    expect(resolveInPolicy('nutrition', 'tiers.yaml')).toBe(
      path.join(POLICY_ROOT, 'nutrition', 'tiers.yaml'),
    );
  });

  it.each(['../data', 'nutrition/../data', '.', '..', 'bad\\namespace', 'bad\0namespace'])(
    'rejects crafted namespace %j',
    (namespace) => {
      expect(() => resolveInPolicy(namespace, 'tiers.yaml')).toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
    },
  );

  it.each(['../data.yaml', 'nested/tier.yaml', '.', '..', 'bad\0segment']) (
    'rejects crafted document segment %j',
    (segment) => {
      expect(() => resolveInPolicy('nutrition', segment)).toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
    },
  );
});
