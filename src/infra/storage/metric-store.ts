import { existsSync } from "node:fs";

import { DuckDBInstance } from "@duckdb/node-api";

import { CoachError } from "../../models/error.ts";
import type { Binding } from "./binding.ts";
import type { MetricStore } from "./types.ts";

/**
 * Read-only access to a profile's derived metric store. Table declaration is the boundary here:
 * DuckDB holds every domain in one file, so plugins never receive SQL or another table's handle.
 */
export class DuckDbMetricStore implements MetricStore {
    readonly tables: readonly string[];

    readonly #namespace: string;
    readonly #file: string;

    constructor(binding: Binding) {
        this.tables = binding.storeTables;
        this.#namespace = binding.namespace;
        this.#file = binding.metricStore();
    }

    async rows(table: string): Promise<unknown[]> {
        this.#assertDeclared(table);
        // A missing derived store is unknown data, not an empty metric history.
        if (!existsSync(this.#file)) {
            throw CoachError.metricStoreMissing(this.#file);
        }

        const instance = await DuckDBInstance.create(this.#file, { access_mode: "READ_ONLY" });
        const connection = await instance.connect();
        try {
            const result = await connection.runAndReadAll(
                `SELECT * REPLACE (CAST(${quoteIdentifier("date")} AS VARCHAR) AS ${quoteIdentifier("date")}) ` +
                    `FROM ${quoteIdentifier(table)} ORDER BY ${quoteIdentifier("date")}`,
            );
            return result.getRowObjectsJS();
        } finally {
            connection.closeSync();
            instance.closeSync();
        }
    }

    async insert(table: string, _rows: readonly unknown[]): Promise<void> {
        this.#assertDeclared(table);
        throw CoachError.metricStoreUnavailable(`insert("${table}")`);
    }

    #assertDeclared(table: string): void {
        if (!this.tables.includes(table)) {
            throw CoachError.metricTableNotDeclared(this.#namespace, table);
        }
    }
}

/** Identifiers cannot be parameterized; quote them after the allowlist check instead. */
function quoteIdentifier(identifier: string): string {
    return `"${identifier.replaceAll('"', '""')}"`;
}
