#!/usr/bin/env node

/**
 * The CLI host: **hook argv up to {@link CoachEngine}, publish the envelope, set an exit code.**
 * Nothing else lives here. No dispatch, no active-set decision, no storage wiring, no plugin
 * construction — those belong to the engine, which runs without any of this file.
 *
 * The two things that *are* genuinely CLI-specific: turning argv into a request (`program.ts`), and
 * deciding which profile a bare invocation means — `--profile`, else `$COACH_PROFILE`. A bot would
 * resolve that from a `chat_id` instead, which is why the engine demands a profile and never guesses.
 */

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { CoachEngine } from "../engine.ts";
import type { OutputSink } from "../infra/io.ts";
import { makeEnvelope, makeGap, type Envelope } from "../models/envelope.ts";
import { CoachError } from "../models/error.ts";
import { resolveProfile } from "../models/profile.ts";
import { parseArgv } from "./program.ts";

/**
 * Parse argv, invoke the engine, emit exactly one JSON envelope on stdout. Every failure — a parse
 * error here, or anything at all inside the engine — folds into that same single-`gap` envelope, so
 * stdout always carries one well-formed result; exit code is `0` iff it is `ok`.
 */
export async function runCli(
    argv: readonly string[],
    stdout: OutputSink = process.stdout,
    stderr: OutputSink = process.stderr,
    env: NodeJS.ProcessEnv = process.env,
    engine: CoachEngine = new CoachEngine({ io: { stdout, stderr }, env }),
): Promise<number> {
    const result = await invoke(engine, argv, env);

    // stdout is framework-reserved: exactly one JSON envelope, no trailing prose.
    stdout.write(`${JSON.stringify(result)}\n`);
    return result.ok ? 0 : 1;
}

async function invoke(
    engine: CoachEngine,
    argv: readonly string[],
    env: NodeJS.ProcessEnv,
): Promise<Envelope<unknown>> {
    try {
        const parsed = parseArgv(argv, engine);
        if (parsed === undefined) {
            throw CoachError.noCommand();
        }

        return await engine.invoke({
            namespace: parsed.namespace,
            verb: parsed.verb,
            profile: resolveProfile(parsed.profileFlag, env),
            input: parsed.input,
        });
    } catch (error: unknown) {
        // Only this adapter's own failures land here; `engine.invoke` never throws.
        return makeEnvelope(null, [makeGap(error)]);
    }
}

function isDirectExecution(): boolean {
    const entrypoint = process.argv[1];
    if (entrypoint === undefined) {
        return false;
    }

    return import.meta.url === pathToFileURL(realpathSync(entrypoint)).href;
}

if (isDirectExecution()) {
    void main();
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
    process.exitCode = await runCli(argv);
}
