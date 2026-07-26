/**
 * The plugin seam's **compile-time** half (amendment §1.4, contract §2.3). Every `@ts-expect-error`
 * here *is* an assertion: `npm run typecheck` fails the moment the line beneath it starts compiling,
 * which is the only thing that keeps two files describing one plugin — `index.ts` and `cli.ts` — in
 * step. Vitest can only prove the runtime half, so that is the single `it` that asserts a value.
 */

import { describe, expect, it } from "vitest";

import type { CliBinding } from "../../src/cli/binding.ts";
import { createContext } from "../../src/context.ts";
import type { DomainPlugin, DomainSummary, PluginDefinition } from "../../src/plugins/index.ts";
import { stubCli } from "../../src/plugins/stub/cli.ts";
import { stubPlugin, type StubPlugin } from "../../src/plugins/stub/index.ts";

const io = { stdout: { write: () => {} }, stderr: { write: () => {} } };

describe("the CLI binding is compile-checked against the plugin", () => {
    it("binds every verb to a method the constructed plugin actually has", () => {
        // Via `DomainPlugin`, the shape the dispatcher holds: methods addressed by the name the
        // binding proved, which is exactly what `engine.invoke` does.
        const domain: DomainPlugin = stubPlugin.create(createContext("pedro", { io }).storage.create("stub"));
        const methods: Readonly<Record<string, unknown>> = domain;

        for (const [verb, bound] of Object.entries(stubCli)) {
            expect(typeof methods[bound.method], verb).toBe("function");
        }
    });

    it("rejects a verb naming a method the plugin does not have", () => {
        const binding = {
            "trailing-load": {
                // @ts-expect-error - `trailingLoad` is not a method on StubPlugin; a rename must not compile.
                method: "trailingLoad",
                narrow: () => undefined,
            },
        } satisfies CliBinding<StubPlugin>;

        expect(binding).toBeDefined();
    });

    it("ties a verb's narrowing to the input of the method it names", () => {
        type DatedPlugin = { summary(input: { date: string }): Promise<DomainSummary> };

        const binding = {
            summary: {
                method: "summary",
                // @ts-expect-error - narrowing must build `summary`'s own input; `{}` has no `date`.
                narrow: () => ({}),
            },
        } satisfies CliBinding<DatedPlugin>;

        expect(binding).toBeDefined();
    });
});

describe("the engine side", () => {
    it("requires the mandatory deterministic summary", () => {
        const definition = {
            key: "no-summary",
            storeTables: [],
            // @ts-expect-error - a domain without `summary` is not a plugin (contract §2.3).
            create: () => ({ inspect: async () => ({ capabilities: [] }) }),
        } satisfies PluginDefinition;

        expect(definition.key).toBe("no-summary");
    });

    it("requires observations on a summary, empty or not", () => {
        // @ts-expect-error - `observations` is required; optional would let a domain forget it exists.
        const summary: DomainSummary = { namespace: "stub", facts: {}, gaps: [] };

        expect(summary.namespace).toBe("stub");
    });
});
