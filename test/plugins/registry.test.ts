import { describe, expect, it } from "vitest";

import { CORE_NAMESPACES } from "../../src/commands/registry.ts";
import {
    assertMandatoryNamespaces,
    MANDATORY_NAMESPACES,
    PLUGIN_REGISTRY,
    registeredPluginKeys,
    resolveActivePlugins,
} from "../../src/plugins/index.ts";

describe("registeredPluginKeys", () => {
    it("lists every namespace this build can construct, running no plugin code", () => {
        expect(registeredPluginKeys()).toEqual(Object.keys(PLUGIN_REGISTRY));
    });
});

describe("resolveActivePlugins", () => {
    it("accepts a registered set and preserves its order", () => {
        expect(resolveActivePlugins(["stub"])).toEqual(["stub"]);
    });

    it("accepts the empty set — a profile may activate nothing", () => {
        expect(resolveActivePlugins([])).toEqual([]);
    });

    it("rejects a duplicate namespace, naming the collision", () => {
        expect(() => resolveActivePlugins(["stub", "stub"])).toThrow(
            'duplicate plugin namespace "stub"',
        );
    });

    it("rejects a namespace reserved by the core, naming it", () => {
        expect(() => resolveActivePlugins(["run"])).toThrow(
            'plugin namespace "run" collides with the core namespace of the same name',
        );
    });

    it("rejects a namespace no plugin is registered under", () => {
        expect(() => resolveActivePlugins(["cycling"])).toThrow(
            'no plugin is registered under the namespace "cycling"',
        );
    });

    it("returns a frozen set, so a caller cannot widen it after validation", () => {
        const active = resolveActivePlugins(["stub"]);

        expect(Object.isFrozen(active)).toBe(true);
    });
});

/**
 * The head coach is the one plugin a profile cannot switch off (amendments §1.2). A profile without
 * it has no mediator — no `decide`, no `plan`, no way to weigh one domain against another — so its
 * absence is a **startup error**, not the benign routing gap an ordinary absent plugin produces
 * (contract §2.4).
 *
 * The rule is declared now and **latent** until Chunk 7 registers `head`: a build that cannot
 * construct the head coach cannot sensibly require it. These assert the rule fires the moment it
 * can, which is why `assertMandatoryNamespaces` takes the registered set rather than reading it.
 */
describe("mandatory namespaces", () => {
    it("names `head`, and only `head`", () => {
        expect(MANDATORY_NAMESPACES).toEqual(["head"]);
    });

    it("leaves `head` claimable by a plugin — it is not a core namespace", () => {
        // If `head` were reserved core-side, resolveActivePlugins would reject the head coach's own
        // namespace forever and Chunk 7 could not register it.
        for (const required of MANDATORY_NAMESPACES) {
            expect(CORE_NAMESPACES).not.toContain(required);
        }
    });

    it("rejects an active set that omits a mandatory namespace the build can construct", () => {
        expect(() => assertMandatoryNamespaces(["stub"], ["stub", "head"])).toThrow(
            'namespace "head" cannot be deactivated',
        );
    });

    it("accepts an active set that includes it", () => {
        expect(() => assertMandatoryNamespaces(["stub", "head"], ["stub", "head"])).not.toThrow();
    });

    it("stays dormant while the build cannot construct it — Chunk 7 arms this", () => {
        expect(() => assertMandatoryNamespaces([], ["stub"])).not.toThrow();
        expect(registeredPluginKeys()).not.toContain("head");
    });

    it("is enforced by resolveActivePlugins, not merely available beside it", () => {
        // Dormant today, so the empty set still resolves; the wiring is what this pins.
        expect(resolveActivePlugins([])).toEqual([]);
    });
});
