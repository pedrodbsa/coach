import { describe, expect, it } from "vitest";

import { describeValue, Violations } from "../../src/models/validation.ts";

describe("Violations", () => {
    it("derives ok from the severities, not from the caller", () => {
        const found = new Violations();
        found.warn("nutrition.meals[lunch].why.one_line", "one line", "3 lines");

        const result = found.resolve({ kept: true });

        expect(result.ok).toBe(true);
        expect(result.value).toEqual({ kept: true });
        expect(result.violations).toHaveLength(1);
    });

    it("drops the value the moment anything hard is found", () => {
        const found = new Violations();
        found.warn("a.warn", "x", "y");
        found.hard("b.hard", "x", "y");

        const result = found.resolve({ kept: true });

        expect(result.ok).toBe(false);
        expect(result.value).toBeNull();
        expect(result.violations.map((violation) => violation.rule)).toEqual(["a.warn", "b.hard"]);
    });

    it("reports every violation, in the order they were found", () => {
        const found = new Violations();
        found.hard("first", "x", "y");
        found.hard("second", "x", "y");

        expect(found.violations.map((violation) => violation.rule)).toEqual(["first", "second"]);
    });

    it("keeps exactly the four fixed fields", () => {
        const found = new Violations();
        found.hard("schema_version.type", "string", "number 0.2");

        expect(Object.keys(found.violations[0]!)).toEqual(["rule", "expected", "actual", "severity"]);
    });
});

describe("describeValue", () => {
    it("names the type first, which is the whole story of an unquoted 0.2", () => {
        expect(describeValue(0.2)).toBe("number 0.2");
        expect(describeValue("0.2")).toBe('string "0.2"');
    });

    it("distinguishes absent from null — missing is not zero, and neither is nothing-yet", () => {
        expect(describeValue(undefined)).toBe("missing");
        expect(describeValue(null)).toBe("null");
        expect(describeValue(0)).toBe("number 0");
    });

    it("summarises containers rather than copying them into a report line", () => {
        expect(describeValue([1, 2, 3])).toBe("list of 3");
        expect(describeValue({ min: 10, max: 12 })).toBe("record { min, max }");
        expect(describeValue("x".repeat(80))).toContain("…");
    });
});
