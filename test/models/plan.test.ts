import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
    makeActionId,
    parseActionId,
    repsShape,
    validatePlan,
    type Plan,
    type Reps,
} from "../../src/models/plan.ts";
import type { Violation } from "../../src/models/validation.ts";
import { parseYaml } from "../../src/utils/yaml.ts";

const FIXTURES = path.join(import.meta.dirname, "../fixtures/plan");

function fixture(name: string): unknown {
    const file = path.join(FIXTURES, name);
    return parseYaml(readFileSync(file, "utf8"), file);
}

/** The clean fixture, freshly cloned so a negative case differs from it by exactly one edit. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the point is to mutate one field
function plan(): any {
    return structuredClone(fixture("2026-07-22.plan.yaml"));
}

function marks(violations: readonly Violation[]): string[] {
    return violations.map((violation) => `${violation.severity}:${violation.rule}`);
}

describe("validatePlan — the prototype's structure", () => {
    it("accepts the prototype, corrected and extended, with no violations at all", () => {
        const result = validatePlan(fixture("2026-07-22.plan.yaml"));

        expect(marks(result.violations)).toEqual([]);
        expect(result.ok).toBe(true);
        expect(result.value?.date).toBe("2026-07-22");
        expect(result.value?.decision.prescribes).toHaveLength(3);
    });

    it("names every defect in the prototype as written, and nothing else", () => {
        const result = validatePlan(fixture("2026-07-22.pre-amendment.plan.yaml"));

        expect(result.ok).toBe(false);
        expect(result.value).toBeNull();
        expect(marks(result.violations).sort()).toEqual(
            [
                // Defect 1 — an unquoted `0.2` is a float, and `0.20` would silently collide with it.
                "hard:schema_version.type",
                // Defect 2 — the head coach naming a nutrition internal.
                "hard:decision.prescribes[nutrition].unknown_key",
                // The five fields added 2026-07-25, which the prototype predates.
                "hard:decision.brief.required",
                "hard:decision.prescribes[running].accept.required",
                "hard:decision.prescribes[strength].accept.required",
                "hard:decision.prescribes[nutrition].accept.required",
                "hard:running.session.action_id.required",
                "hard:strength.session.action_id.required",
                "hard:nutrition.meals[breakfast].action_id.required",
                "hard:nutrition.meals[pre_training].action_id.required",
                "hard:nutrition.meals[lunch].action_id.required",
                "hard:nutrition.meals[snack].action_id.required",
                "hard:nutrition.meals[dinner].action_id.required",
            ].sort(),
        );
    });

    it("rejects a non-object, and reports the missing root keys of an empty one", () => {
        expect(marks(validatePlan("a plan, honest").violations)).toEqual(["hard:plan.type"]);
        expect(marks(validatePlan({}).violations).sort()).toEqual(
            [
                "hard:schema_version.required",
                "hard:date.required",
                "hard:profile.required",
                "hard:title.required",
                "hard:decision.required",
                "hard:markers.required",
            ].sort(),
        );
    });
});

describe("validatePlan — schema_version (3.5 pins the value; this pins the type)", () => {
    it("makes a float a hard violation naming the type", () => {
        const value = plan();
        value.schema_version = 0.2;

        const violation = validatePlan(value).violations.find(
            (candidate) => candidate.rule === "schema_version.type",
        );

        expect(violation).toEqual({
            rule: "schema_version.type",
            expected: "string",
            actual: "number 0.2",
            severity: "hard",
        });
    });

    it("keeps a version comparable as a string, trailing zero and all", () => {
        const value = plan();
        value.schema_version = "0.20";

        const result = validatePlan(value);

        expect(result.ok).toBe(true);
        expect(result.value?.schema_version).toBe("0.20");
        expect(result.value?.schema_version).not.toBe("0.2");
    });
});

describe("validatePlan — reps in three shapes", () => {
    it("round-trips all three as distinct shapes", () => {
        const result = validatePlan(plan());
        const movements = result.value?.strength?.session?.movements ?? [];

        expect(movements[0]?.reps).toEqual([10, 10, 10, 8]);
        expect(movements[1]?.reps).toEqual({ min: 10, max: 12 });
        expect(movements[5]?.reps).toEqual({ value: 12, per: "side" });
        expect(movements.map((movement) => (movement.reps ? repsShape(movement.reps) : null))).toEqual([
            "per_set",
            "range",
            "range",
            "per_set",
            "range",
            "per_side",
            null,
        ]);
    });

    it("classifies each shape without normalising it", () => {
        expect(repsShape([10, 8])).toBe("per_set");
        expect(repsShape({ min: 10, max: 12 })).toBe("range");
        expect(repsShape({ value: 12, per: "side" })).toBe("per_side");
    });

    it("makes a fourth shape a hard violation", () => {
        for (const fourth of [10, "10-12", { target: 10 }, { min: 10 }, { value: 12 }]) {
            const value = plan();
            value.strength.session.movements[0].reps = fourth;

            expect(marks(validatePlan(value).violations)).toContain(
                "hard:strength.session.movements[0].reps.shape",
            );
        }
    });

    it("keeps a per-set list to numbers and a range to min <= max", () => {
        const listed = plan();
        listed.strength.session.movements[0].reps = [10, "eight"];
        expect(marks(validatePlan(listed).violations)).toContain(
            "hard:strength.session.movements[0].reps.shape",
        );

        const ranged = plan();
        ranged.strength.session.movements[1].reps = { min: 12, max: 10 };
        expect(marks(validatePlan(ranged).violations)).toContain(
            "hard:strength.session.movements[1].reps.range",
        );
    });
});

describe("validatePlan — petitions (contract §6.3, §6.7)", () => {
    it("accepts { from, need, why } with an optional horizon", () => {
        const value = plan();
        value.strength.petitions = [
            { from: "strength", need: "more recovery between pulls", why: "two hard pulls in three days" },
        ];

        expect(validatePlan(value).ok).toBe(true);
    });

    it("rejects a target field — a petition is addressed to the head coach, full stop", () => {
        const value = plan();
        value.running.petitions[0].target = "strength";

        const violation = validatePlan(value).violations.find(
            (candidate) => candidate.rule === "running.petitions[0].unknown_key",
        );

        expect(violation?.severity).toBe("hard");
        expect(violation?.actual).toContain("target");
    });

    it("rejects an unknown horizon", () => {
        const value = plan();
        value.running.petitions[0].horizon = "next_year";

        expect(marks(validatePlan(value).violations)).toContain("hard:running.petitions[0].horizon.enum");
    });

    it("requires the three sentences a petition is made of", () => {
        const value = plan();
        value.running.petitions = [{ from: "running" }];

        expect(marks(validatePlan(value).violations).sort()).toEqual(
            ["hard:running.petitions[0].need.required", "hard:running.petitions[0].why.required"].sort(),
        );
    });
});

describe("validatePlan — the acceptance condition on each prescribed intent", () => {
    it("makes a missing acceptance condition a hard violation naming the module", () => {
        const value = plan();
        delete value.decision.prescribes[1].accept;

        const violation = validatePlan(value).violations.find(
            (candidate) => candidate.rule === "decision.prescribes[strength].accept.required",
        );

        expect(violation?.severity).toBe("hard");
        expect(violation?.expected).toContain("acceptance condition");
    });

    it("makes a prose-only acceptance condition a hard violation", () => {
        const sentence = plan();
        sentence.decision.prescribes[2].accept = "hit the protein and fat floors";
        expect(marks(validatePlan(sentence).violations)).toContain(
            "hard:decision.prescribes[nutrition].accept.structured",
        );

        const whyOnly = plan();
        whyOnly.decision.prescribes[2].accept = { why: "hit the protein and fat floors" };
        expect(marks(validatePlan(whyOnly).violations)).toContain(
            "hard:decision.prescribes[nutrition].accept.structured",
        );

        const emptyClauses = plan();
        emptyClauses.decision.prescribes[2].accept = { all: [] };
        expect(marks(validatePlan(emptyClauses).violations)).toContain(
            "hard:decision.prescribes[nutrition].accept.structured",
        );
    });

    it("requires each clause to be machine-checkable: a metric, an operator, a value", () => {
        const value = plan();
        value.decision.prescribes[0].accept.all = [{ metric: "intensity.hard_effort" }];

        expect(marks(validatePlan(value).violations).sort()).toEqual(
            [
                "hard:decision.prescribes[running].accept.all[0].op.required",
                "hard:decision.prescribes[running].accept.all[0].value.required",
            ].sort(),
        );
    });

    it("holds the operator to a vocabulary a domain can evaluate", () => {
        const value = plan();
        value.decision.prescribes[0].accept.all[1].op = "roughly";

        expect(marks(validatePlan(value).violations)).toContain(
            "hard:decision.prescribes[running].accept.all[1].op.enum",
        );
    });

    it("holds a clause's value to a type its operator can compare", () => {
        const ordered = plan();
        ordered.decision.prescribes[2].accept.all[0].value = "lots";
        expect(marks(validatePlan(ordered).violations)).toContain(
            "hard:decision.prescribes[nutrition].accept.all[0].value.type",
        );

        const membership = plan();
        membership.decision.prescribes[0].accept.all = [
            { metric: "session.target_type", op: "in", value: "hr" },
        ];
        expect(marks(validatePlan(membership).violations)).toContain(
            "hard:decision.prescribes[running].accept.all[0].value.type",
        );
    });

    it("keeps a why beside the condition, never instead of it", () => {
        const value = plan();
        const accept = value.decision.prescribes[2].accept;

        expect(accept.why).toBeTruthy();
        expect(validatePlan(value).ok).toBe(true);
        expect(accept.all).toHaveLength(3);
    });

    it("refuses two intents for one module — the head coach does not leave the domain to pick", () => {
        const value = plan();
        value.decision.prescribes.push(structuredClone(value.decision.prescribes[0]));

        const violation = validatePlan(value).violations.find(
            (candidate) => candidate.rule === "decision.prescribes.one_per_module",
        );

        expect(violation?.severity).toBe("hard");
        expect(violation?.actual).toContain("running");
    });

    it("warns when a prescribed module delivered no block", () => {
        const value = plan();
        delete value.running;

        const result = validatePlan(value);

        expect(result.ok).toBe(true);
        expect(marks(result.violations)).toEqual(["warn:decision.prescribes[running].delivered"]);
    });
});

describe("validatePlan — a block states what it produced", () => {
    it("accepts an explicit null session, and warns only that the intent went undelivered", () => {
        const value = plan();
        value.running.session = null;

        const result = validatePlan(value);

        expect(result.ok).toBe(true);
        expect(marks(result.violations)).toEqual(["warn:decision.prescribes[running].delivered"]);
    });

    it("refuses a block that omits the key instead of nulling it", () => {
        const value = plan();
        delete value.strength.session;
        delete value.nutrition.tier;
        delete value.nutrition.meals;

        expect(marks(validatePlan(value).violations)).toEqual(
            expect.arrayContaining([
                "hard:strength.session.required",
                "hard:nutrition.tier.required",
                "hard:nutrition.meals.required",
            ]),
        );
    });

    it("keeps a block that only carries a petition legal, once its session is null", () => {
        const value = plan();
        value.running = {
            session: null,
            petitions: [{ from: "running", need: "a second treadmill slot", why: "one datapoint is not a trend" }],
        };

        const result = validatePlan(value);

        expect(result.ok).toBe(true);
        expect(result.value?.running?.petitions?.[0]?.from).toBe("running");
    });
});

describe("validatePlan — brief provenance on the decision", () => {
    it("makes a decision with no brief a hard violation", () => {
        const value = plan();
        delete value.decision.brief;

        expect(marks(validatePlan(value).violations)).toContain("hard:decision.brief.required");
    });

    it("requires a timestamp with a zone, since staleness is arithmetic on it", () => {
        const value = plan();
        value.decision.brief.computed_at = "2026-07-22 06:12";

        expect(marks(validatePlan(value).violations)).toContain(
            "hard:decision.brief.computed_at.timestamp",
        );
    });

    it("carries the brief's computed_at through to the typed decision", () => {
        expect(validatePlan(plan()).value?.decision.brief.computed_at).toBe("2026-07-22T06:12:00Z");
    });
});

describe("action ids — core owns action identity", () => {
    it("mints an id from the day, the module and the slot", () => {
        expect(makeActionId({ date: "2026-07-22", module: "nutrition", slot: "lunch" })).toBe(
            "2026-07-22:nutrition:lunch",
        );
        expect(parseActionId("2026-07-22:running:session")).toEqual({
            date: "2026-07-22",
            module: "running",
            slot: "session",
        });
    });

    it("refuses a part that would make the id ambiguous", () => {
        expect(() => makeActionId({ date: "2026-07-22", module: "nutrition", slot: "a:b" })).toThrow(
            RangeError,
        );
        expect(parseActionId("lunch")).toBeNull();
    });

    it("survives an amend: the id is a function of the slot, never of the prescription", () => {
        const value = plan();
        const lunch = value.nutrition.meals[2];
        const before = lunch.action_id;

        // An amend, before the fact: chicken becomes tofu and the domain re-derives the meal.
        lunch.items = [{ food: "tofu", qty: 220, unit: "g" }, { food: "rice", qty: 130, unit: "g" }];
        lunch.macros = { kcal: 640, p: 46, c: 84, f: 16 };
        lunch.at = "14:45";
        lunch.status = "amended";

        expect(makeActionId({ date: value.date, module: "nutrition", slot: lunch.id })).toBe(before);
        expect(validatePlan(value).ok).toBe(true);
    });

    it("makes a missing id on any athlete-facing action a hard violation", () => {
        const value = plan();
        delete value.nutrition.meals[3].action_id;
        delete value.running.session.action_id;

        expect(marks(validatePlan(value).violations).sort()).toEqual(
            [
                "hard:running.session.action_id.required",
                "hard:nutrition.meals[snack].action_id.required",
            ].sort(),
        );
    });

    it("makes a duplicate within one plan a hard violation naming both actions", () => {
        const value = plan();
        value.nutrition.meals[4].action_id = value.nutrition.meals[0].action_id;

        const violation = validatePlan(value).violations.find(
            (candidate) => candidate.rule === "action_id.unique",
        );

        expect(violation?.severity).toBe("hard");
        expect(violation?.actual).toContain("nutrition.meals[breakfast]");
        expect(violation?.actual).toContain("nutrition.meals[dinner]");
        expect(violation?.actual).toContain("2026-07-22:nutrition:breakfast");
    });

    it("warns — never blocks — when an id is not the one core would have minted", () => {
        const value = plan();
        value.nutrition.meals[0].action_id = "breakfast-1";

        const result = validatePlan(value);

        expect(result.ok).toBe(true);
        expect(marks(result.violations)).toEqual(["warn:nutrition.meals[breakfast].action_id.derived"]);
    });
});

describe("validatePlan — logged entries and `actual`", () => {
    const entry = {
        action_id: "2026-07-22:nutrition:lunch",
        at: "2026-07-22T15:02:11Z",
        occurred: "2026-07-22T14:15:00Z",
        mode: "report",
        delta: { rice_g: 90 },
        said: "had lunch but only about two thirds of the rice",
    };

    function logged(mutate: (draft: Record<string, unknown>) => void = () => {}) {
        const value = plan();
        const draft = structuredClone(entry) as Record<string, unknown>;
        mutate(draft);
        value.nutrition.actual = { entries: [draft] };
        return value;
    }

    it("accepts an entry carrying at, occurred and a mode", () => {
        const result = validatePlan(logged());

        expect(marks(result.violations)).toEqual([]);
        expect(result.value?.nutrition?.actual?.entries?.[0]?.mode).toBe("report");
    });

    it("accepts an amend as readily as a report", () => {
        expect(validatePlan(logged((draft) => (draft.mode = "amend"))).ok).toBe(true);
    });

    it("makes any other mode a hard violation", () => {
        expect(marks(validatePlan(logged((draft) => (draft.mode = "deviation"))).violations)).toContain(
            "hard:nutrition.actual.entries[0].mode.enum",
        );
    });

    it("requires both timestamps — when it was said and when it happened", () => {
        expect(
            marks(validatePlan(logged((draft) => delete draft.occurred)).violations),
        ).toContain("hard:nutrition.actual.entries[0].occurred.required");
        expect(marks(validatePlan(logged((draft) => delete draft.at)).violations)).toContain(
            "hard:nutrition.actual.entries[0].at.required",
        );
    });

    it("requires the entry to name the action it targets", () => {
        expect(
            marks(validatePlan(logged((draft) => delete draft.action_id)).violations),
        ).toContain("hard:nutrition.actual.entries[0].action_id.required");
    });

    it("warns when an entry targets an action this plan does not prescribe", () => {
        const value = logged((draft) => (draft.action_id = "2026-07-22:nutrition:second_lunch"));

        const result = validatePlan(value);

        expect(result.ok).toBe(true);
        expect(marks(result.violations)).toEqual(["warn:nutrition.actual.entries[0].action_id.targets"]);
    });

    it("treats an absent and a null `actual` as the same nothing-yet, both legal", () => {
        const absent = plan();
        delete absent.running.actual;

        expect(validatePlan(absent).ok).toBe(true);
        expect(validatePlan(absent).value?.running?.actual).toBeUndefined();
        expect(validatePlan(plan()).value?.running?.actual).toBeNull();
    });

    it("refuses an empty `actual`: silence is unknown, and unknown is a state, not a zero", () => {
        const empty = plan();
        empty.running.actual = {};
        expect(marks(validatePlan(empty).violations)).toContain("hard:running.actual.signal");

        const emptyList = plan();
        emptyList.running.actual = { entries: [] };
        expect(marks(validatePlan(emptyList).violations)).toContain("hard:running.actual.signal");
    });

    it("accepts an `actual` whose only signal is observed data", () => {
        const value = plan();
        value.running.actual = { observed: { distance_km: 5.0, avg_hr: 139 } };

        expect(validatePlan(value).ok).toBe(true);
    });
});

describe("validatePlan — targetless steps and unresolved loads stay representable", () => {
    it("returns the plan and warns when a run step carries no target", () => {
        const value = plan();
        value.running.session.steps.push({ kind: "cooldown", duration_min: 5, target: null });

        const result = validatePlan(value);

        expect(result.ok).toBe(true);
        expect(result.value?.running?.session?.steps[1]?.target).toBeNull();
        expect(marks(result.violations)).toEqual(["warn:running.session.steps[1].target.required"]);
    });

    it("returns the plan and warns when a movement's load is unresolved", () => {
        const nulled = plan();
        nulled.strength.session.movements[2].load = null;
        expect(marks(validatePlan(nulled).violations)).toEqual([
            "warn:strength.session.movements[2].load.resolved",
        ]);

        const valueless = plan();
        valueless.strength.session.movements[2].load = { value: null, unit: "kg" };
        expect(marks(validatePlan(valueless).violations)).toEqual([
            "warn:strength.session.movements[2].load.resolved",
        ]);
    });

    it("does not call a bodyweight movement unresolved", () => {
        const value = plan();
        value.strength.session.movements[2].load = { value: null, unit: "bodyweight" };

        expect(marks(validatePlan(value).violations)).toEqual([]);
    });

    it("holds a run target to hr or pace, the two the watch can be pushed", () => {
        const value = plan();
        value.running.session.steps[0].target = { type: "vibes", max: 142 };

        expect(marks(validatePlan(value).violations)).toContain(
            "hard:running.session.steps[0].target.type",
        );
    });

    it("holds a movement's garmin enums to a decided status", () => {
        const value = plan();
        value.strength.session.movements[0].garmin.status = "probably_fine";

        expect(marks(validatePlan(value).violations)).toContain(
            "hard:strength.session.movements[0].garmin.status.enum",
        );
    });
});

describe("validatePlan — missing is null, never zero", () => {
    it("accepts a null macro without reading it as a zero", () => {
        const value = plan();
        value.nutrition.meals[1].macros = { kcal: null, p: null, c: null, f: null };

        const result = validatePlan(value);

        expect(result.ok).toBe(true);
        expect(result.value?.nutrition?.meals[1]?.macros?.kcal).toBeNull();
        expect(result.value?.nutrition?.meals[1]?.macros?.kcal).not.toBe(0);
    });

    it("accepts a null marker, and a real zero beside it", () => {
        const value = plan();
        value.markers.hrv = { last_night_ms: null, week_avg_ms: 72, status: null };
        value.markers.stress_avg = 0;

        const result = validatePlan(value);

        expect(result.ok).toBe(true);
        expect(result.value?.markers.stress_avg).toBe(0);
    });

    it("keeps markers bounded — a fact is a scalar or a flat record of them", () => {
        const value = plan();
        value.markers.sleep = { stages: { deep: { pct: 18.5 } } };

        expect(marks(validatePlan(value).violations)).toContain("hard:markers.sleep.bounded");
    });

    it("accepts a session with no fixed start, and a totals block with no actual yet", () => {
        const value = plan();
        value.running.session.start = null;
        value.nutrition.totals.actual = null;

        expect(validatePlan(value).ok).toBe(true);
    });
});

describe("validatePlan — prose stays a one-liner", () => {
    it("warns when a why grows past one line", () => {
        const value = plan();
        value.strength.session.movements[0].why =
            "The progression trigger was met on Jun 29.\nSo take 110 kg across all four sets today.";

        const result = validatePlan(value);

        expect(result.ok).toBe(true);
        expect(marks(result.violations)).toEqual(["warn:strength.session.movements[0].why.one_line"]);
    });

    it("warns when a why grows past the cap", () => {
        const value = plan();
        value.decision.why = `${"a rationale that keeps going ".repeat(12)}.`;

        expect(marks(validatePlan(value).violations)).toEqual(["warn:decision.why.one_line"]);
    });

    it("accepts the folded two-sentence rationale the prototype ships", () => {
        expect(validatePlan(plan()).value?.decision.why).toContain("Green light with load");
    });

    it("keeps a readiness verdict a token a rule can compare, not a sentence", () => {
        const value = plan();
        value.decision.readiness = "green, but be careful with the legs";

        expect(marks(validatePlan(value).violations)).toContain("hard:decision.readiness.token");
    });
});

describe("validatePlan — unknown keys", () => {
    it("refuses an invented key rather than persisting it", () => {
        const value = plan();
        value.strength.session.movements[0].tempo = "3-1-1";

        const violation = validatePlan(value).violations.find(
            (candidate) => candidate.rule === "strength.session.movements[0].unknown_key",
        );

        expect(violation?.severity).toBe("hard");
        expect(violation?.actual).toBe("tempo");
        expect(violation?.expected).toContain("slot");
    });

    it("leaves a domain's own validate block alone — Chunks 5 and 6 own its content", () => {
        const value = plan();
        value.nutrition.validate.pre_bed_protein_min_g = 45;
        value.nutrition.validate.iso_with_fattiest = true;

        expect(validatePlan(value).ok).toBe(true);
    });

    it("warns rather than fails on a root block no domain in this build owns", () => {
        const value = plan();
        value.mobility = { session: null };

        const result = validatePlan(value);

        expect(result.ok).toBe(true);
        expect(marks(result.violations)).toEqual(["warn:plan.unknown_block"]);
    });
});

describe("validatePlan — the typed surface it hands back", () => {
    it("narrows to Plan so a caller reads fields without casting", () => {
        const result = validatePlan(fixture("2026-07-22.plan.yaml"));
        if (!result.ok) {
            expect.unreachable("the clean fixture must validate");
        }

        const typed: Plan = result.value;
        const reps: Reps | null | undefined = typed.strength?.session?.movements[0]?.reps;

        expect(typed.profile).toBe("pedro");
        expect(typed.flags).toEqual([]);
        expect(reps && repsShape(reps)).toBe("per_set");
    });
});
