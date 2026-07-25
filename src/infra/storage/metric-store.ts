import { CoachError } from "../../models/error.ts";
import type { MetricStore } from "./types.ts";

/**
 * `MetricStore` is interface-only in Chunk 2 (the plan grows no database here). It fails by name
 * rather than returning an empty result set, because an empty result is indistinguishable from
 * "no data" — and *missing ≠ zero* is exactly what a silent `[]` would break.
 */
export class UnavailableMetricStore implements MetricStore {
    readonly tables: readonly string[];

    constructor(tables: readonly string[]) {
        this.tables = Object.freeze([...tables]);
    }

    async rows(table: string): Promise<unknown[]> {
        throw CoachError.metricStoreUnavailable(`rows("${table}")`);
    }

    async insert(table: string, _rows: readonly unknown[]): Promise<void> {
        throw CoachError.metricStoreUnavailable(`insert("${table}")`);
    }
}
