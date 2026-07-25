/**
 * The engine is exercised here with **no CLI at all** — no argv, no Commander, no stdout. If any of
 * these tests needed something out of `cli/`, the host boundary would have leaked.
 */

import { describe, expect, it } from "vitest";

import { CoachEngine } from "../src/engine.ts";
import { makeEnvelope } from "../src/models/envelope.ts";
import type { IPlugin, PluginCommands } from "../src/plugins/index.ts";

describe("CoachEngine", () => {
    it("invokes a core command", async () => {
        const engine = new CoachEngine();

        const result = await engine.invoke({ namespace: "core", verb: "version", profile: "pedro" });

        expect(result.ok).toBe(true);
        expect(result.data).toMatchObject({ schema_version: "0.2" });
    });

    it("invokes an active plugin command with namespace-bound storage", async () => {
        const engine = new CoachEngine({ activePlugins: ["stub"] });

        const result = await engine.invoke({ namespace: "stub", verb: "summary", profile: "pedro" });

        expect(result).toMatchObject({ ok: true, data: { namespace: "stub" }, gaps: [] });
    });

    it("reports what it routes, core first", () => {
        expect(new CoachEngine({ activePlugins: ["stub"] }).namespaces()).toEqual(["core", "stub"]);
        expect(new CoachEngine({ activePlugins: [] }).namespaces()).toEqual(["core"]);
        expect(new CoachEngine().coreVerbs("core")).toEqual(["version"]);
        expect(new CoachEngine().coreVerbs("stub")).toEqual([]);
    });

    it("defaults to every registered plugin being active", () => {
        expect(new CoachEngine().activePlugins()).toEqual(["stub"]);
    });

    it("rejects a malformed active set at construction, not per request", () => {
        expect(() => new CoachEngine({ activePlugins: ["run"] })).toThrow(
            'plugin namespace "run" collides with the core namespace of the same name',
        );
    });

    describe("never throws — every failure is a gap", () => {
        it("for a namespace this profile has not activated", async () => {
            const engine = new CoachEngine({ activePlugins: [] });

            const result = await engine.invoke({
                namespace: "stub",
                verb: "summary",
                profile: "pedro",
            });

            expect(result).toMatchObject({
                ok: false,
                data: null,
                gaps: [
                    {
                        field: "command",
                        reason: 'unknown namespace "stub"',
                        action: "Use a registered namespace: core.",
                    },
                ],
            });
        });

        it("for a verb the namespace does not have", async () => {
            const engine = new CoachEngine({ activePlugins: ["stub"] });

            const result = await engine.invoke({
                namespace: "stub",
                verb: "nonesuch",
                profile: "pedro",
            });

            expect(result.gaps[0]).toMatchObject({ reason: 'unknown command "stub nonesuch"' });
        });

        it("for a core verb that does not exist", async () => {
            const result = await new CoachEngine().invoke({
                namespace: "core",
                verb: "nonesuch",
                profile: "pedro",
            });

            expect(result.gaps[0]).toMatchObject({ reason: 'unknown command "core nonesuch"' });
        });

        it("for a profile name that would escape its scope", async () => {
            const result = await new CoachEngine().invoke({
                namespace: "core",
                verb: "version",
                profile: "../partner",
            });

            expect(result.ok).toBe(false);
            expect(result.gaps[0].field).toBe("command");
            expect(result.gaps[0].reason).toContain("path separator");
        });

        it("for a command that throws", async () => {
            const engine = new CoachEngine({
                activePlugins: ["stub"],
                buildPluginFactory: () => ({
                    create: (): IPlugin => ({
                        key: "stub",
                        commands: {
                            summary: {
                                synergies: [],
                                execute: () => {
                                    throw new Error("boom");
                                },
                            },
                        } satisfies PluginCommands,
                    }),
                }),
            });

            const result = await engine.invoke({
                namespace: "stub",
                verb: "summary",
                profile: "pedro",
            });

            expect(result).toMatchObject({ ok: false, gaps: [{ reason: "boom" }] });
        });

        it("for a command that rejects", async () => {
            const engine = new CoachEngine({
                activePlugins: ["stub"],
                buildPluginFactory: () => ({
                    create: (): IPlugin => ({
                        key: "stub",
                        commands: {
                            summary: {
                                synergies: [],
                                execute: () => Promise.reject(new Error("async boom")),
                            },
                        } satisfies PluginCommands,
                    }),
                }),
            });

            const result = await engine.invoke({
                namespace: "stub",
                verb: "summary",
                profile: "pedro",
            });

            expect(result).toMatchObject({ ok: false, gaps: [{ reason: "async boom" }] });
        });
    });

    it("scopes each invocation to its own profile", async () => {
        const seen: string[] = [];
        const engine = new CoachEngine({
            activePlugins: ["stub"],
            buildPluginFactory: (storageFactory) => ({
                create: (key): IPlugin => {
                    const storage = storageFactory.create(key);
                    return {
                        key: "stub",
                        commands: {
                            summary: {
                                synergies: [],
                                execute: async () => {
                                    seen.push(storage.namespace);
                                    return makeEnvelope({ namespace: storage.namespace });
                                },
                            },
                        } satisfies PluginCommands,
                    };
                },
            }),
        });

        await engine.invoke({ namespace: "stub", verb: "summary", profile: "pedro" });
        await engine.invoke({ namespace: "stub", verb: "summary", profile: "partner" });

        // A fresh context per invocation: nothing from the first run survives into the second.
        expect(seen).toEqual(["stub", "stub"]);
    });

    it("passes host input through to the command unmodified", async () => {
        let received: unknown;
        const engine = new CoachEngine({
            activePlugins: ["stub"],
            buildPluginFactory: () => ({
                create: (): IPlugin => ({
                    key: "stub",
                    commands: {
                        summary: {
                            synergies: [],
                            execute: async (input) => {
                                received = input;
                                return makeEnvelope(null);
                            },
                        },
                    } satisfies PluginCommands,
                }),
            }),
        });

        await engine.invoke({
            namespace: "stub",
            verb: "summary",
            profile: "pedro",
            input: { weight: 74.2 },
        });

        expect(received).toEqual({ weight: 74.2 });
    });
});
