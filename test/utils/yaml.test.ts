import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseYaml, serializeYaml, writeFileAtomic } from '../../src/utils/yaml.ts';
import { coachError } from '../support/errors.ts';

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'coach-yaml-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('YAML codec', () => {
  it('round-trips the engine value shapes', () => {
    const value = {
      title: 'Quality session',
      date: '2026-07-23',
      active: true,
      load: 42.5,
      optional: null,
      nested: {
        steps: ['warmup', 'intervals', 'cooldown'],
        targets: [{ min: 135, max: 145 }, { per: 'side', value: 10 }],
      },
    };

    expect(parseYaml(serializeYaml(value), '/plans/2026-07-23.yaml')).toEqual(value);
  });

  it('throws a named error with the source path for malformed input', () => {
    const sourcePath = '/plans/broken.yaml';

    expect(() => parseYaml('items: [one, two', sourcePath)).toThrow(coachError("YAML_PARSE_ERROR"));
    expect(() => parseYaml('items: [one, two', sourcePath)).toThrow(sourcePath);
  });

  it('rejects non-core tags instead of constructing a value from them', () => {
    expect(() => parseYaml('value: !custom tagged', '/plans/tagged.yaml')).toThrow(coachError("YAML_PARSE_ERROR"));
    expect(() => parseYaml('value: !!timestamp 2026-07-23', '/plans/date.yaml')).toThrow(
      coachError('YAML_PARSE_ERROR'),
    );
  });
});

describe('writeFileAtomic', () => {
  it('uses a same-directory temporary file and preserves the original if writing is interrupted', async () => {
    const directory = temporaryDirectory();
    const target = path.join(directory, 'nested', 'plan.yaml');
    const temporaryPaths: string[] = [];

    await writeFileAtomic(target, 'old content');

    await expect(
      writeFileAtomic(target, 'new content', {
        writeFile: async (temporaryPath) => {
          temporaryPaths.push(String(temporaryPath));
          throw new Error('simulated interrupted write');
        },
      }),
    ).rejects.toThrow('simulated interrupted write');

    expect(temporaryPaths).toHaveLength(1);
    expect(path.dirname(temporaryPaths[0])).toBe(path.dirname(target));
    expect(readFileSync(target, 'utf8')).toBe('old content');
    expect(existsSync(temporaryPaths[0])).toBe(false);
  });
});
