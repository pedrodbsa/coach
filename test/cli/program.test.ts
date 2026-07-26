/**
 * The parser, on its own. What matters here is what parsing **does not** do: a plugin's verbs are
 * static data in its CLI binding (amendment §1.7), so the command tree is built without constructing
 * a plugin, without a `Storage` and without a profile — which is what stops a missing profile
 * shadowing every routing and parse error.
 */

import { describe, expect, it } from "vitest";

import { parseArgv } from "../../src/cli/program.ts";
import { CoachEngine } from "../../src/engine.ts";
import { coachError } from "../support/errors.ts";

/** Any construction attempt fails the test rather than silently succeeding against a temp tree. */
function engineThatCannotConstructAPlugin(): CoachEngine {
    return new CoachEngine({
        activePlugins: ["stub"],
        buildPluginFactory: () => {
            throw new Error("a plugin was constructed while building the command tree");
        },
    });
}

describe("parseArgv", () => {
    it("builds the tree for a plugin verb without constructing a plugin or resolving a profile", () => {
        const parsed = parseArgv(["stub", "summary"], engineThatCannotConstructAPlugin());

        expect(parsed).toEqual({
            namespace: "stub",
            verb: "summary",
            input: {},
            profileFlag: undefined,
        });
    });

    it("routes every declared verb of an active plugin, not just the one asked for", () => {
        expect(parseArgv(["stub", "inspect"], engineThatCannotConstructAPlugin())?.verb).toBe("inspect");
    });

    it("carries the profile flag as given, resolving nothing", () => {
        expect(parseArgv(["core", "version", "--profile=pedro"], new CoachEngine())?.profileFlag).toBe("pedro");
        expect(parseArgv(["core", "version", "--profile", "../partner"], new CoachEngine())?.profileFlag).toBe(
            "../partner",
        );
    });

    it("fails with the parser's own error when no runnable leaf was selected", () => {
        // Commander answers a bare `coach` with its help error before the `undefined` return can be
        // reached. What this pins is that it is *the parser's* failure: no profile is involved.
        let thrown: unknown;
        try {
            parseArgv([], new CoachEngine());
        } catch (error: unknown) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(Error);
        expect((thrown as Error).message).not.toContain("profile");
    });

    it("fails routing on a namespace the engine does not answer", () => {
        expect(() => parseArgv(["cycling", "targets"], new CoachEngine())).toThrow(coachError("UNKNOWN_NAMESPACE"));
    });

    it("fails routing on a verb the namespace does not have, in the engine's words", () => {
        const engine = engineThatCannotConstructAPlugin();

        expect(() => parseArgv(["stub", "nonesuch"], engine)).toThrow(coachError("UNKNOWN_COMMAND"));
        expect(() => parseArgv(["stub", "nonesuch"], engine)).toThrow('unknown command "stub nonesuch"');
        expect(() => parseArgv(["core", "nonesuch"], new CoachEngine())).toThrow('unknown command "core nonesuch"');
    });
});
