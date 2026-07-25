import { describe, expect, it } from "vitest";

import { mergeLayers } from "../../src/utils/merge.ts";

describe("mergeLayers — effective policy = defaults ⊕ overrides", () => {
    it("merges objects recursively, keeping default keys the override does not mention", () => {
        const merged = mergeLayers(
            { protein: { floor: 140, per_meal: 35 }, fat: { floor: 60 } },
            { protein: { per_meal: 45 } },
        );

        expect(merged).toEqual({ protein: { floor: 140, per_meal: 45 }, fat: { floor: 60 } });
    });

    it("replaces an array wholesale rather than concatenating", () => {
        const merged = mergeLayers(
            { zones: [120, 140, 160, 175], equipment: ["barbell", "rack"] },
            { zones: [128, 148, 166] },
        );

        expect(merged).toEqual({ zones: [128, 148, 166], equipment: ["barbell", "rack"] });
    });

    it("replaces a nested array wholesale too", () => {
        const merged = mergeLayers(
            { running: { zones: [1, 2, 3], easy_cap: 145 } },
            { running: { zones: [4, 5] } },
        );

        expect(merged).toEqual({ running: { zones: [4, 5], easy_cap: 145 } });
    });

    it("replaces scalars, including with an explicit null — an override is a decision", () => {
        expect(mergeLayers({ tier: "high", cap: 3 }, { tier: "low", cap: null })).toEqual({
            tier: "low",
            cap: null,
        });
    });

    it("replaces when the two sides disagree on shape", () => {
        expect(mergeLayers({ rest: { days: 2 } }, { rest: 2 })).toEqual({ rest: 2 });
        expect(mergeLayers({ rest: 2 }, { rest: { days: 2 } })).toEqual({ rest: { days: 2 } });
    });

    it("adds keys the defaults never had", () => {
        expect(mergeLayers({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
    });

    it("returns the surviving side when the other is a non-object document", () => {
        expect(mergeLayers([1, 2], [3])).toEqual([3]);
        expect(mergeLayers("default", "override")).toBe("override");
    });

    it("mutates neither input", () => {
        const defaults = { nested: { a: 1, list: [1] } };
        const overrides = { nested: { b: 2 } };

        mergeLayers(defaults, overrides);

        expect(defaults).toEqual({ nested: { a: 1, list: [1] } });
        expect(overrides).toEqual({ nested: { b: 2 } });
    });

    it("copies rather than aliases the override's nested values", () => {
        const overrides = { nested: { list: [1, 2] } };
        const merged = mergeLayers({ nested: { a: 1 } }, overrides) as {
            nested: { list: number[] };
        };

        merged.nested.list.push(3);

        expect(overrides.nested.list).toEqual([1, 2]);
    });
});
