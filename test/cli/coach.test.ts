import { describe, expect, it } from 'vitest';

import { runCli } from '../../src/cli/coach.ts';
import { CoachEngine } from '../../src/engine.ts';

function sink(): { chunks: string[]; write: (chunk: string) => void } {
  const chunks: string[] = [];
  return {
    chunks,
    write: (chunk: string) => {
      chunks.push(chunk);
    },
  };
}

describe('coach CLI', () => {
  it('dispatches core version through Commander and emits one envelope', async () => {
    const stdout = sink();
    const stderr = sink();

    const exitCode = await runCli(['core', 'version', '--profile=pedro'], stdout, stderr);

    expect(exitCode).toBe(0);
    expect(stdout.chunks).toHaveLength(1);
    expect(JSON.parse(stdout.chunks[0])).toMatchObject({
      ok: true,
      data: { version: '0.1.0', schema_version: '0.2' },
      gaps: [],
      schema_version: '0.2',
    });
    expect(stderr.chunks).toEqual([]);
  });

  it('errors cleanly when no profile is given by flag or environment', async () => {
    const stdout = sink();
    const stderr = sink();

    const exitCode = await runCli(['core', 'version'], stdout, stderr, {});

    expect(exitCode).not.toBe(0);
    expect(stdout.chunks).toHaveLength(1);
    expect(JSON.parse(stdout.chunks[0])).toMatchObject({
      ok: false,
      data: null,
      gaps: [
        {
          field: 'command',
          action: 'Correct the command arguments and retry.',
        },
      ],
      schema_version: '0.2',
    });
    expect(stderr.chunks).toEqual([]);
  });

  it('falls back to COACH_PROFILE when --profile is omitted', async () => {
    const stdout = sink();
    const stderr = sink();

    const exitCode = await runCli(['core', 'version'], stdout, stderr, {
      COACH_PROFILE: 'pedro',
    });

    expect(exitCode).toBe(0);
    expect(stdout.chunks).toHaveLength(1);
    expect(JSON.parse(stdout.chunks[0])).toMatchObject({ ok: true, gaps: [] });
    expect(stderr.chunks).toEqual([]);
  });

  it('rejects a malformed COACH_PROFILE without leaking a stack trace', async () => {
    const stdout = sink();
    const stderr = sink();

    const exitCode = await runCli(['core', 'version'], stdout, stderr, {
      COACH_PROFILE: '../partner',
    });

    expect(exitCode).not.toBe(0);
    expect(stdout.chunks).toHaveLength(1);
    expect(JSON.parse(stdout.chunks[0])).toMatchObject({
      ok: false,
      data: null,
      gaps: [{ field: 'command' }],
    });
    expect(stderr.chunks).toEqual([]);
  });

  it('wraps an unknown namespace without leaking Commander prose', async () => {
    const stdout = sink();
    const stderr = sink();

    const exitCode = await runCli(['unknown', 'version', '--profile=pedro'], stdout, stderr);

    expect(exitCode).not.toBe(0);
    expect(stdout.chunks).toHaveLength(1);
    expect(JSON.parse(stdout.chunks[0])).toMatchObject({
      ok: false,
      data: null,
      gaps: [{ field: 'command' }],
    });
    expect(stderr.chunks).toEqual([]);
  });

  it('routes an active plugin namespace through its declared command', async () => {
    const stdout = sink();
    const stderr = sink();
    const engine = new CoachEngine({ activePlugins: ['stub'] });

    const exitCode = await runCli(['stub', 'summary', '--profile=pedro'], stdout, stderr, {}, engine);

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.chunks[0])).toMatchObject({
      ok: true,
      data: { namespace: 'stub' },
      gaps: [],
    });
    expect(stderr.chunks).toEqual([]);
  });

  it('hands plugin commands only their bound storage capability', async () => {
    const stdout = sink();
    const stderr = sink();

    const exitCode = await runCli(
      ['stub', 'inspect', '--profile=pedro'],
      stdout,
      stderr,
      {},
      new CoachEngine({ activePlugins: ['stub'] }),
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.chunks[0])).toMatchObject({
      ok: true,
      data: {
        namespace: 'stub',
        capabilities: ['history', 'logbook', 'namespace', 'policy', 'profile', 'state', 'store'],
      },
    });
  });

  it('reports an inactive plugin as an unknown namespace and lists the active namespaces', async () => {
    const stdout = sink();
    const stderr = sink();

    // `stub` is registered but this profile has activated nothing: absence is structural (§2.4),
    // and the engine decides it — the factory would have happily constructed it.
    const exitCode = await runCli(
      ['stub', 'summary', '--profile=pedro'],
      stdout,
      stderr,
      {},
      new CoachEngine({ activePlugins: [] }),
    );

    expect(exitCode).not.toBe(0);
    expect(stdout.chunks).toHaveLength(1);
    expect(JSON.parse(stdout.chunks[0])).toEqual({
      ok: false,
      data: null,
      gaps: [
        {
          field: 'command',
          reason: 'unknown namespace "stub"',
          action: 'Use a registered namespace: core.',
        },
      ],
      schema_version: '0.2',
    });
    expect(stderr.chunks).toEqual([]);
  });

  it('rejects a profile that is not a single safe name', async () => {
    const stdout = sink();
    const stderr = sink();

    const exitCode = await runCli(['core', 'version', '--profile=../other'], stdout, stderr);

    expect(exitCode).not.toBe(0);
    expect(stdout.chunks).toHaveLength(1);
    expect(JSON.parse(stdout.chunks[0])).toMatchObject({
      ok: false,
      data: null,
      gaps: [{ field: 'command' }],
      schema_version: '0.2',
    });
    expect(stderr.chunks).toEqual([]);
  });
});
