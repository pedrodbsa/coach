/** Generic file operations for YAML documents and JSONL logs at already-resolved paths. */

import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parseYaml, serializeYaml, writeFileAtomic } from "./yaml.ts";

export const DOCUMENT_EXTENSION = ".yaml";
export const LOG_EXTENSION = ".jsonl";

function isEnoent(error: unknown): boolean {
    return error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

/** A missing document is `null` — never `{}`. Turning that into a `Gap` is the caller's job. */
export async function readYamlDocument(filePath: string): Promise<unknown> {
    let source: string;
    try {
        source = await readFile(filePath, "utf8");
    } catch (error) {
        if (isEnoent(error)) {
            return null;
        }
        throw error;
    }
    return parseYaml(source, filePath);
}

export async function writeYamlDocument(filePath: string, value: unknown): Promise<void> {
    await writeFileAtomic(filePath, serializeYaml(value));
}

/** Filenames in `directory` carrying `extension`, sorted. A missing directory lists empty. */
export async function listRawFiles(directory: string, extension: string): Promise<string[]> {
    try {
        return (await readdir(directory)).filter((entry) => entry.endsWith(extension)).sort();
    } catch (error) {
        if (isEnoent(error)) {
            return [];
        }
        throw error;
    }
}

/** Document ids in `directory`, extension stripped and sorted. A missing directory lists empty. */
export async function listYamlDocuments(directory: string): Promise<string[]> {
    const files = await listRawFiles(directory, DOCUMENT_EXTENSION);
    return files.map((entry) => path.basename(entry, DOCUMENT_EXTENSION));
}

/** Appends one line. Never rewrites the file, so earlier entries stay byte-identical. */
export async function appendJsonLine(filePath: string, entry: unknown): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
}

/** The last `limit` lines, newest first. A missing log reads as an empty list. */
export async function readRecentJsonLines(filePath: string, limit: number): Promise<unknown[]> {
    let source: string;
    try {
        source = await readFile(filePath, "utf8");
    } catch (error) {
        if (isEnoent(error)) {
            return [];
        }
        throw error;
    }

    return source
        .split("\n")
        .filter((line) => line.trim() !== "")
        .slice(-limit)
        .reverse()
        .map((line) => JSON.parse(line) as unknown);
}
