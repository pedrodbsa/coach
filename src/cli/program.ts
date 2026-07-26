/**
 * The Commander adapter: argv → a transport-neutral {@link ParsedInvocation}. It parses and routes,
 * nothing else — it builds no context, constructs no plugin, runs no command and touches no stdout.
 * Swap Commander for another parser and the engine is untouched.
 */

import { Command } from "commander";

import type { CommandSurface } from "../engine.ts";
import { PROFILE_ENV_VAR } from "../models/profile.ts";
import { CoachError } from "../models/error.ts";

/** What the parse yields: which command, what input, and the profile flag as given. */
export interface ParsedInvocation {
    readonly namespace: string;
    readonly verb: string;
    readonly input: unknown;
    /** The global `--profile` value as given (or undefined); resolved downstream. */
    readonly profileFlag: string | undefined;
}

/**
 * Parses `argv`, or returns `undefined` if no runnable leaf was selected (e.g. `coach` or
 * `coach core` with no verb).
 *
 * The whole tree comes from `surface`, core and plugin alike, because a plugin's verbs are static
 * data in its CLI binding — so parsing needs no profile, and a routing failure cannot be shadowed by
 * one. A namespace the engine does not answer fails **here** (§2.4) with its own cause rather than
 * Commander's prose; `exitOverride` turns parse failures into thrown `CommanderError`s for the
 * caller to fold into a gap, and Commander's own output is suppressed.
 */
export function parseArgv(argv: readonly string[], surface: CommandSurface): ParsedInvocation | undefined {
    let parsed: ParsedInvocation | undefined;

    const bind =
        (namespace: string, verb: string) =>
        (options: unknown, cmd: Command): void => {
            parsed = {
                namespace,
                verb,
                input: options,
                profileFlag: cmd.optsWithGlobals().profile,
            };
        };

    const program = new Command()
        .name("coach")
        .helpOption(false)
        .allowExcessArguments(false)
        .showSuggestionAfterError(false)
        .exitOverride()
        .configureOutput({
            writeOut: () => {},
            writeErr: () => {},
        })
        .option("--profile <profile>", `profile whose isolated data scope is active (falls back to $${PROFILE_ENV_VAR})`);

    const namespaces = surface.namespaces();

    // Ahead of the parse, so absence is reported by *routing* (§2.4) in the engine's own words
    // rather than as Commander prose — and, with no profile resolved yet, never as a missing profile.
    const [requestedNamespace, requestedVerb] = positionals(argv);
    if (requestedNamespace !== undefined && !namespaces.some((known) => known === requestedNamespace)) {
        throw CoachError.unknownNamespace(requestedNamespace, namespaces);
    }
    if (
        requestedNamespace !== undefined &&
        requestedVerb !== undefined &&
        !surface.verbs(requestedNamespace).some((known) => known === requestedVerb)
    ) {
        throw CoachError.unknownCommand(requestedNamespace, requestedVerb);
    }

    for (const namespace of namespaces) {
        const verbs = surface.verbs(namespace);
        if (verbs.length === 0) {
            continue;
        }
        const node = program.command(namespace).helpOption(false);
        for (const verb of verbs) {
            node.command(verb).helpOption(false).action(bind(namespace, verb));
        }
    }

    program.parse([...argv], { from: "user" });

    return parsed;
}

function positionals(argv: readonly string[]): string[] {
    const result: string[] = [];
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "--profile") {
            index += 1;
            continue;
        }
        if (!argument.startsWith("-")) {
            result.push(argument);
        }
    }
    return result;
}
