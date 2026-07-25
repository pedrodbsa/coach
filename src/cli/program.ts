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
 * The command tree is built from `surface`, so a namespace the engine does not answer contributes no
 * Commander node and fails **here**, in routing (§2.4) — absence is structural, not a message a
 * plugin gets to write. Commander's output is suppressed and `exitOverride` turns parse failures
 * into thrown `CommanderError`s for the caller to fold into a gap.
 */
export function parseArgv(
    argv: readonly string[],
    surface: CommandSurface,
): ParsedInvocation | undefined {
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

    // Core verbs are known without a profile, so their nodes are registered up front.
    for (const namespace of namespaces) {
        const verbs = surface.coreVerbs(namespace);
        if (verbs.length === 0) {
            continue;
        }
        const node = program.command(namespace).helpOption(false);
        for (const verb of verbs) {
            node.command(verb).helpOption(false).action(bind(namespace, verb));
        }
    }

    // A plugin's verbs need a constructed plugin, which needs a profile that is not resolved yet —
    // so the requested leaf is registered on demand. §2.6's two-phase parse (Chunk 13) removes this.
    const [requestedNamespace, requestedVerb] = positionals(argv);
    if (
        requestedNamespace !== undefined &&
        requestedVerb !== undefined &&
        surface.coreVerbs(requestedNamespace).length === 0
    ) {
        if (!namespaces.some((known) => known === requestedNamespace)) {
            throw CoachError.unknownNamespace(requestedNamespace, namespaces);
        }

        program
            .command(requestedNamespace)
            .helpOption(false)
            .command(requestedVerb)
            .helpOption(false)
            .action(bind(requestedNamespace, requestedVerb));
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
