import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { DuckDBInstance } from "@duckdb/node-api";

const FIXTURE = path.join(import.meta.dirname, "running-daily-metrics.csv");

/**
 * The fixture is reviewable CSV rather than a committed binary: files are canonical and DuckDB is
 * derived. Chunk 4's extractor will rebuild this same kind of store from git-held records.
 */
export async function buildFixtureMetricStore(file: string): Promise<void> {
    mkdirSync(path.dirname(file), { recursive: true });
    const instance = await DuckDBInstance.create(file);
    const connection = await instance.connect();
    try {
        await connection.run(
            "CREATE TABLE running_daily_metrics (date DATE, distance_km DOUBLE, session_type VARCHAR)",
        );
        for (const line of readFileSync(FIXTURE, "utf8").trim().split("\n").slice(1)) {
            const [date, distanceKm, sessionType] = line.split(",");
            await connection.run(
                "INSERT INTO running_daily_metrics VALUES (?, ?, ?)",
                [date, Number(distanceKm), sessionType],
            );
        }
    } finally {
        connection.closeSync();
        instance.closeSync();
    }
}
