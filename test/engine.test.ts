/**
 * The engine is exercised here with **no CLI at all** — no argv, no Commander, no stdout. If any of
 * these tests needed something out of `cli/`, the host boundary would have leaked.
 */

import { describe, expect, it } from "vitest";

import { CoachEngine } from "../src/engine.ts";
import type { DomainPlugin, IPlugin } from "../src/plugins/index.ts";

/** A stand-in for the stub's engine side: whatever `summary` the test needs, and nothing else. */
function fakeStub(summary: DomainPlugin["summary"]): IPlugin {
    return { key: "stub", domain: { summary } };
}

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

    it("wraps the domain result itself — the plugin returns no envelope", async () => {
        const engine = new CoachEngine({ activePlugins: ["stub"] });

        const result = await engine.invoke({ namespace: "stub", verb: "summary", profile: "pedro" });

        expect(result.data).toEqual({ namespace: "stub", facts: {}, observations: [], gaps: [] });
        expect(result.schema_version).toBe("0.2");
    });

    it("copies a degraded result's gaps to the envelope, leaving them on the data", async () => {
        const gap = { field: "week_km", reason: "no session logged this week", action: "Log a run." };
        const engine = new CoachEngine({
            activePlugins: ["stub"],
            buildPluginFactory: () => ({
                create: () =>
                    fakeStub(async () => ({
                        namespace: "stub",
                        facts: { week_km: null },
                        observations: [],
                        gaps: [gap],
                    })),
            }),
        });

        const result = await engine.invoke({ namespace: "stub", verb: "summary", profile: "pedro" });

        // `ok` follows the gaps the core lifted; the brief still needs them attributed to the domain.
        expect(result).toMatchObject({ ok: false, gaps: [gap] });
        expect(result.data).toMatchObject({ gaps: [gap] });
    });

    it("reports what it routes, core first, from static declarations", () => {
        expect(new CoachEngine({ activePlugins: ["stub"] }).namespaces()).toEqual(["core", "stub"]);
        expect(new CoachEngine({ activePlugins: [] }).namespaces()).toEqual(["core"]);
        expect(new CoachEngine().verbs("core")).toEqual(["version"]);
        expect(new CoachEngine({ activePlugins: ["stub"] }).verbs("stub")).toEqual(["summary", "inspect"]);
        expect(new CoachEngine({ activePlugins: [] }).verbs("stub")).toEqual([]);
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
                    create: () =>
                        fakeStub(() => {
                            throw new Error("boom");
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
                    create: () => fakeStub(() => Promise.reject(new Error("async boom"))),
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
                    return fakeStub(async () => {
                        seen.push(storage.namespace);
                        return { namespace: storage.namespace, facts: {}, observations: [], gaps: [] };
                    });
                },
            }),
        });

        await engine.invoke({ namespace: "stub", verb: "summary", profile: "pedro" });
        await engine.invoke({ namespace: "stub", verb: "summary", profile: "partner" });

        // A fresh context per invocation: nothing from the first run survives into the second.
        expect(seen).toEqual(["stub", "stub"]);
    });

    it("hands the host's input to the binding, which decides what the method sees", async () => {
        let received: unknown = "never called";
        const engine = new CoachEngine({
            activePlugins: ["stub"],
            buildPluginFactory: () => ({
                create: () =>
                    fakeStub(async (input) => {
                        received = input;
                        return { namespace: "stub", facts: {}, observations: [], gaps: [] };
                    }),
            }),
        });

        await engine.invoke({
            namespace: "stub",
            verb: "summary",
            profile: "pedro",
            input: { weight: 74.2 },
        });

        // The stub's binding narrows to nothing — argv declarations are task 3.0 — so the raw bag
        // stops at the binding rather than reaching the domain function untyped.
        expect(received).toBeUndefined();
    });
});
