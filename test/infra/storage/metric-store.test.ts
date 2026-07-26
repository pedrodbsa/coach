import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CoachError } from "../../../src/models/error.ts";
import { StorageFactory } from "../../../src/infra/storage/index.ts";
import { buildFixtureMetricStore } from "../../fixtures/store/build.ts";

let dataRoot: string;
let policyRoot: string;

function store(profile = "pedro", tables = ["running_daily_metrics"]) {
    return new StorageFactory(profile, { dataRoot, policyRoot }).create("running", tables).store;
}

function storeFile(profile: string): string {
    return path.join(dataRoot, profile, "store", "metrics.duckdb");
}

beforeEach(() => {
    dataRoot = path.join(tmpdir(), `coach-metrics-data-${crypto.randomUUID()}`);
    policyRoot = path.join(tmpdir(), `coach-metrics-policy-${crypto.randomUUID()}`);
    mkdirSync(dataRoot, { recursive: true });
    mkdirSync(policyRoot, { recursive: true });
});

afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true });
    rmSync(policyRoot, { recursive: true, force: true });
});

describe("DuckDbMetricStore", () => {
    it("returns a declared table's seeded rows in date order", async () => {
        await buildFixtureMetricStore(storeFile("pedro"));

        const rows = await store().rows("running_daily_metrics");

        expect(rows).toHaveLength(35);
        expect(rows[0]).toMatchObject({ date: "2026-06-21", distance_km: 6, session_type: "easy" });
        expect(rows.at(-1)).toMatchObject({ date: "2026-07-25", distance_km: 6, session_type: "easy" });
    });

    it("rejects a table the namespace did not declare", async () => {
        await buildFixtureMetricStore(storeFile("pedro"));

        await expect(store().rows("strength_sessions")).rejects.toMatchObject({
            code: "METRIC_TABLE_NOT_DECLARED",
            message: expect.stringContaining('"strength_sessions"'),
        } satisfies Partial<CoachError>);
        await expect(store().rows("strength_sessions")).rejects.toThrow('namespace "running"');
    });

    it("does not turn a missing per-profile store into empty rows", async () => {
        await expect(store().rows("running_daily_metrics")).rejects.toMatchObject({
            code: "METRIC_STORE_UNAVAILABLE",
            message: expect.stringContaining("metric store is missing"),
        } satisfies Partial<CoachError>);
    });

    it("keeps writes unavailable until Chunk 4", async () => {
        await expect(store().insert("running_daily_metrics", [])).rejects.toMatchObject({
            code: "METRIC_STORE_UNAVAILABLE",
            message: expect.stringContaining("Chunk 4"),
        } satisfies Partial<CoachError>);
    });

    it("binds each handle to its own profile's store file", async () => {
        await buildFixtureMetricStore(storeFile("partner"));

        expect(await store("partner").rows("running_daily_metrics")).toHaveLength(35);
        await expect(store("pedro").rows("running_daily_metrics")).rejects.toMatchObject({
            code: "METRIC_STORE_UNAVAILABLE",
        } satisfies Partial<CoachError>);
    });
});
