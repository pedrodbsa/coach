import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { StorageFactory } from "../../../src/infra/storage/index.ts";
import type { HistoryEntry } from "../../../src/infra/storage/index.ts";
import { coachError } from "../../support/errors.ts";

const PROFILE = "pedro";
const NAMESPACE = "stub";

let dataRoot: string;
let policyRoot: string;

/** Writes a file below one of the two roots, creating its parents — the fixture half of a store. */
function seed(root: string, relative: string, contents: string): string {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents, "utf8");
    return target;
}

function storage(namespace: string = NAMESPACE, profile: string = PROFILE) {
    return new StorageFactory(profile, { dataRoot, policyRoot }).create(namespace);
}

beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), "coach-storage-data-"));
    policyRoot = mkdtempSync(path.join(tmpdir(), "coach-storage-policy-"));
});

afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true });
    rmSync(policyRoot, { recursive: true, force: true });
});

describe("Storage — the tree (§1.3)", () => {
    it("binds the namespace it was constructed with", () => {
        expect(storage().namespace).toBe(NAMESPACE);
    });

    it("reads shipped defaults from policy/<ns>/<doc>.yaml", async () => {
        seed(policyRoot, "stub/rules.yaml", "cap: 3\n");

        expect(await storage().policy.read("rules")).toEqual({ cap: 3 });
    });

    it("reads overrides, profile, state and history under data/<profile>/<kind>/<ns>/", async () => {
        seed(dataRoot, "pedro/policy/stub/rules.yaml", "cap: 5\n");
        seed(dataRoot, "pedro/profile/stub/zones.yaml", "max_hr: 190\n");
        seed(dataRoot, "pedro/state/stub/today.yaml", "done: true\n");
        seed(
            dataRoot,
            "pedro/history/stub/log.jsonl",
            '{"at":"2026-07-22T06:00:00.000Z","kind":"decision","by":"stub","summary":"logged"}\n',
        );

        const store = storage();

        expect(await store.policy.read("rules")).toEqual({ cap: 5 });
        expect(await store.profile.read("zones")).toEqual({ max_hr: 190 });
        expect(await store.state.read("today")).toEqual({ done: true });
        expect(await store.history.recent(10)).toEqual([
            {
                at: "2026-07-22T06:00:00.000Z",
                kind: "decision",
                by: "stub",
                summary: "logged",
            },
        ]);
    });

    it("reads the profile-level logbook, which is not namespaced", async () => {
        seed(dataRoot, "pedro/logbook/2026-07.yaml", "days:\n  - date: 2026-07-22\n");

        expect(await storage().logbook.read("2026-07")).toEqual({
            days: [{ date: "2026-07-22" }],
        });
        expect(await storage().logbook.list()).toEqual(["2026-07"]);
    });

    it("keeps two namespaces in separate directories", async () => {
        seed(dataRoot, "pedro/state/stub/today.yaml", "who: stub\n");
        seed(dataRoot, "pedro/state/other/today.yaml", "who: other\n");

        expect(await storage("stub").state.read("today")).toEqual({ who: "stub" });
        expect(await storage("other").state.read("today")).toEqual({ who: "other" });
    });

    it("keeps two profiles in separate directories", async () => {
        seed(dataRoot, "pedro/state/stub/today.yaml", "who: pedro\n");
        seed(dataRoot, "partner/state/stub/today.yaml", "who: partner\n");

        expect(await storage(NAMESPACE, "pedro").state.read("today")).toEqual({ who: "pedro" });
        expect(await storage(NAMESPACE, "partner").state.read("today")).toEqual({
            who: "partner",
        });
    });
});

describe("PolicyReader — effective policy = defaults ⊕ overrides", () => {
    it("returns the default when no override exists", async () => {
        seed(policyRoot, "stub/rules.yaml", "cap: 3\nnested:\n  a: 1\n");

        expect(await storage().policy.read("rules")).toEqual({ cap: 3, nested: { a: 1 } });
    });

    it("returns the override when no default exists", async () => {
        seed(dataRoot, "pedro/policy/stub/rules.yaml", "cap: 9\n");

        expect(await storage().policy.read("rules")).toEqual({ cap: 9 });
    });

    it("returns null when neither exists — missing is never {}", async () => {
        expect(await storage().policy.read("rules")).toBeNull();
    });

    it("merges objects recursively and replaces arrays wholesale", async () => {
        seed(
            policyRoot,
            "stub/rules.yaml",
            "zones: [120, 140, 160]\nprotein:\n  floor: 140\n  per_meal: 35\n",
        );
        seed(dataRoot, "pedro/policy/stub/rules.yaml", "zones: [128, 148]\nprotein:\n  per_meal: 45\n");

        expect(await storage().policy.read("rules")).toEqual({
            zones: [128, 148],
            protein: { floor: 140, per_meal: 45 },
        });
    });

    it("reports both layers unmerged so `decide` can answer why a value is what it is", async () => {
        seed(policyRoot, "stub/rules.yaml", "cap: 3\n");
        seed(dataRoot, "pedro/policy/stub/rules.yaml", "cap: 9\n");

        expect(await storage().policy.layers("rules")).toEqual({
            defaults: { cap: 3 },
            overrides: { cap: 9 },
        });
    });

    it("reports a null side when that layer is absent", async () => {
        seed(policyRoot, "stub/rules.yaml", "cap: 3\n");
        expect(await storage().policy.layers("rules")).toEqual({
            defaults: { cap: 3 },
            overrides: null,
        });

        seed(dataRoot, "pedro/policy/stub/only-override.yaml", "cap: 9\n");
        expect(await storage().policy.layers("only-override")).toEqual({
            defaults: null,
            overrides: { cap: 9 },
        });

        expect(await storage().policy.layers("absent")).toEqual({
            defaults: null,
            overrides: null,
        });
    });

    it("never reads another namespace's defaults", async () => {
        seed(policyRoot, "other/rules.yaml", "cap: 3\n");

        expect(await storage("stub").policy.read("rules")).toBeNull();
    });
});

describe("DocumentReader / DocumentStore — profile and state", () => {
    it("round-trips a written document through real YAML on disk", async () => {
        const store = storage();
        const value = {
            date: "2026-07-23",
            totals: { protein: 178, fat: 62.5 },
            meals: ["breakfast", "lunch"],
            skipped: null,
            done: true,
        };

        await store.state.write("today", value);

        const onDisk = readFileSync(path.join(dataRoot, "pedro/state/stub/today.yaml"), "utf8");
        expect(onDisk).toContain("protein: 178");
        expect(await store.state.read("today")).toEqual(value);
    });

    it("overwrites a state document wholesale rather than merging into it", async () => {
        const store = storage();

        await store.state.write("today", { a: 1, b: 2 });
        await store.state.write("today", { a: 9 });

        expect(await store.state.read("today")).toEqual({ a: 9 });
    });

    it("creates the namespace directory on first write", async () => {
        await storage().state.write("today", { a: 1 });

        expect(readFileSync(path.join(dataRoot, "pedro/state/stub/today.yaml"), "utf8")).toContain(
            "a: 1",
        );
    });

    it("reads a missing document as null, never {}", async () => {
        expect(await storage().state.read("absent")).toBeNull();
        expect(await storage().profile.read("absent")).toBeNull();
        expect(await storage().logbook.read("2026-01")).toBeNull();
    });

    it("lists its own documents by id, sorted, without the extension", async () => {
        seed(dataRoot, "pedro/state/stub/today.yaml", "a: 1\n");
        seed(dataRoot, "pedro/state/stub/loads.yaml", "a: 1\n");
        seed(dataRoot, "pedro/state/stub/notes.txt", "ignored");
        seed(dataRoot, "pedro/state/other/theirs.yaml", "a: 1\n");

        expect(await storage().state.list()).toEqual(["loads", "today"]);
    });

    it("lists nothing when the namespace directory does not exist", async () => {
        expect(await storage().state.list()).toEqual([]);
        expect(await storage().profile.list()).toEqual([]);
        expect(await storage().logbook.list()).toEqual([]);
    });

    it("surfaces a malformed document as a parse error rather than a partial value", async () => {
        seed(dataRoot, "pedro/state/stub/today.yaml", "a: [1, 2\n");

        await expect(storage().state.read("today")).rejects.toThrow(/today\.yaml/);
    });
});

/**
 * Rows carry the shared envelope `{ at, kind, by, summary, payload? }` (amendments §5.4) so that a
 * later core-side `coach query` can filter across namespaces without each domain having invented its
 * own row shape. Domain-specific fields belong in `payload`, not at the top level.
 */
function entry(at: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
    return { at, kind: "decision", by: "stub", summary: "a decision was taken", ...overrides };
}

describe("AppendOnlyLog — history", () => {
    it("appends without rewriting: the first entry stays byte-identical", async () => {
        const store = storage();
        const logPath = path.join(dataRoot, "pedro/history/stub/log.jsonl");

        await store.history.append(entry("2026-07-22T06:00:00.000Z", { summary: "first" }));
        const afterFirst = readFileSync(logPath);

        await store.history.append(entry("2026-07-23T06:00:00.000Z", { summary: "second" }));
        const afterSecond = readFileSync(logPath);

        expect(afterSecond.subarray(0, afterFirst.length)).toEqual(afterFirst);
    });

    it("returns both entries, most recent first", async () => {
        const store = storage();

        await store.history.append(entry("2026-07-22T06:00:00.000Z", { summary: "first" }));
        await store.history.append(entry("2026-07-23T06:00:00.000Z", { summary: "second" }));

        expect(await store.history.recent(10)).toEqual([
            entry("2026-07-23T06:00:00.000Z", { summary: "second" }),
            entry("2026-07-22T06:00:00.000Z", { summary: "first" }),
        ]);
    });

    it("round-trips domain-specific fields under `payload`", async () => {
        const store = storage();
        const row = entry("2026-07-23T06:00:00.000Z", {
            kind: "proposal.promoted",
            payload: { document: "zones", rounds: 2, easy_cap: 138 },
        });

        await store.history.append(row);

        expect(await store.history.recent(1)).toEqual([row]);
    });

    it("caps at `limit`, keeping the newest", async () => {
        const store = storage();
        for (const day of ["21", "22", "23"]) {
            await store.history.append(entry(`2026-07-${day}T06:00:00.000Z`));
        }

        expect(await store.history.recent(2)).toEqual([
            entry("2026-07-23T06:00:00.000Z"),
            entry("2026-07-22T06:00:00.000Z"),
        ]);
    });

    it("reads an absent log as an empty list", async () => {
        expect(await storage().history.recent(5)).toEqual([]);
    });

    it("writes one JSON object per line", async () => {
        await storage().history.append(
            entry("2026-07-23T06:00:00.000Z", { summary: "line\nbreak" }),
        );

        const lines = readFileSync(path.join(dataRoot, "pedro/history/stub/log.jsonl"), "utf8")
            .split("\n")
            .filter((line) => line !== "");
        expect(lines).toHaveLength(1);
        expect(JSON.parse(lines[0])).toEqual(
            entry("2026-07-23T06:00:00.000Z", { summary: "line\nbreak" }),
        );
    });

    it("rejects a persisted row that predates the envelope, rather than reading it as valid", async () => {
        // A hand-edited or pre-amendment row: `at` alone is no longer a well-formed entry.
        seed(dataRoot, "pedro/history/stub/log.jsonl", '{"at":"2026-07-22T06:00:00.000Z"}\n');

        await expect(storage().history.recent(5)).rejects.toThrow(/kind.*by.*summary|envelope/i);
    });

    it("rejects a non-positive limit rather than guessing", async () => {
        await expect(storage().history.recent(0)).rejects.toThrow();
    });

    it("gives a stray top-level field nowhere to go — it belongs in `payload`", async () => {
        // Checked by `tsc -p tsconfig.test.json`, which fails if this error does *not* occur: the
        // open index signature is gone, so a domain field cannot sit beside the envelope's own.
        await storage().history.append(
            // @ts-expect-error - `decision` is domain vocabulary; it belongs under `payload`.
            entry("2026-07-23T06:00:00.000Z", { decision: "quality" }),
        );
    });
});

describe("MetricStore — read-only until Chunk 4", () => {
    it("names a missing store and keeps writes explicitly deferred to Chunk 4", async () => {
        const store = new StorageFactory(PROFILE, { dataRoot, policyRoot }).create(NAMESPACE, ["sessions"]);

        await expect(store.store.rows("sessions")).rejects.toThrow(coachError("METRIC_STORE_UNAVAILABLE"));
        await expect(store.store.rows("sessions")).rejects.toThrow(/missing/i);
        await expect(store.store.insert("sessions", [{ a: 1 }])).rejects.toThrow(/Chunk 4/);
    });

    it("reports the tables the plugin declared, empty for a non-quantitative domain", () => {
        expect(storage().store.tables).toEqual([]);
        expect(
            new StorageFactory(PROFILE, {
                dataRoot,
                policyRoot,
            }).create(NAMESPACE, ["strength_sets"]).store.tables,
        ).toEqual(["strength_sets"]);
    });
});

describe("containment — no handle produces a path outside its own namespace", () => {
    const craftedSegments = [
        "..",
        ".",
        "../partner",
        "../../etc/passwd",
        "nested/doc",
        "back\\slash",
        "nul\0byte",
        "",
    ];

    it.each(craftedSegments)("rejects namespace %j at construction", (namespace) => {
        expect(() => storage(namespace)).toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
    });

    it.each(craftedSegments)("rejects profile %j at construction", (profile) => {
        expect(() => storage(NAMESPACE, profile)).toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
    });

    it.each(craftedSegments)("policy.read rejects document id %j", async (document) => {
        await expect(storage().policy.read(document)).rejects.toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
    });

    it.each(craftedSegments)("policy.layers rejects document id %j", async (document) => {
        await expect(storage().policy.layers(document)).rejects.toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
    });

    it.each(craftedSegments)("profile.read rejects document id %j", async (document) => {
        await expect(storage().profile.read(document)).rejects.toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
    });

    it.each(craftedSegments)("state.read rejects document id %j", async (document) => {
        await expect(storage().state.read(document)).rejects.toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
    });

    it.each(craftedSegments)("state.write rejects document id %j", async (document) => {
        await expect(storage().state.write(document, { a: 1 })).rejects.toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
    });

    it.each(craftedSegments)("logbook.read rejects month %j", async (month) => {
        await expect(storage().logbook.read(month)).rejects.toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
    });

    it("writes nothing when a crafted document id is rejected", async () => {
        await expect(storage().state.write("../../escaped", { a: 1 })).rejects.toThrow(
            coachError("PROFILE_SCOPE_VIOLATION"),
        );

        expect(() => readFileSync(path.join(dataRoot, "escaped.yaml"))).toThrow();
        expect(() => readFileSync(path.join(dataRoot, "pedro/escaped.yaml"))).toThrow();
    });

    it("cannot reach a sibling namespace through a crafted profile-kind read", async () => {
        seed(dataRoot, "pedro/profile/other/secret.yaml", "leak: true\n");

        await expect(storage("stub").profile.read("../other/secret")).rejects.toThrow(
            coachError("PROFILE_SCOPE_VIOLATION"),
        );
    });

    it("cannot reach the shipped policy tree of another namespace", async () => {
        seed(policyRoot, "other/rules.yaml", "leak: true\n");

        await expect(storage("stub").policy.read("../other/rules")).rejects.toThrow(
            coachError("PROFILE_SCOPE_VIOLATION"),
        );
    });
});

describe("policy.list — both layers", () => {
    it("unions shipped defaults and overrides, deduped and sorted", async () => {
        seed(policyRoot, "stub/tiers.yaml", "a: 1\n");
        seed(policyRoot, "stub/rules.yaml", "a: 1\n");
        seed(dataRoot, "pedro/policy/stub/rules.yaml", "a: 2\n");
        seed(dataRoot, "pedro/policy/stub/personal.yaml", "a: 3\n");

        expect(await storage().policy.list()).toEqual(["personal", "rules", "tiers"]);
    });
});

describe("propose — the only way a plugin touches policy", () => {
    it("writes under proposals/ and leaves the live override byte-identical", async () => {
        seed(policyRoot, "stub/rules.yaml", "cap: 3\n");
        const livePath = seed(dataRoot, "pedro/policy/stub/rules.yaml", "cap: 5\n");

        const id = await storage().policy.propose("rules", { cap: 9 }, { why: "too easy" });

        expect(readFileSync(livePath, "utf8")).toBe("cap: 5\n");
        expect(await storage().policy.read("rules")).toEqual({ cap: 5 });
        expect(
            readFileSync(path.join(dataRoot, `pedro/proposals/stub/rules.${id}.yaml`), "utf8"),
        ).toContain("cap: 9");
    });

    it("proposes a profile document without writing it", async () => {
        const livePath = seed(dataRoot, "pedro/profile/stub/zones.yaml", "max_hr: 190\n");

        await storage().profile.propose("zones", { max_hr: 186 }, { why: "retested" });

        expect(readFileSync(livePath, "utf8")).toBe("max_hr: 190\n");
        expect(await storage().profile.read("zones")).toEqual({ max_hr: 190 });
    });

    it.each(["..", ".", "../partner", "nested/doc", "nul\0byte", ""])(
        "rejects document id %j",
        async (document) => {
            await expect(
                storage().policy.propose(document, { a: 1 }, { why: "x" }),
            ).rejects.toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
            await expect(
                storage().profile.propose(document, { a: 1 }, { why: "x" }),
            ).rejects.toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
        },
    );
});
