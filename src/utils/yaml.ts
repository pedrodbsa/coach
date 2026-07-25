import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseDocument, stringify, visit } from "yaml";

import { CoachError } from "../models/error.ts";

const CORE_TAGS = new Set([
    "tag:yaml.org,2002:map",
    "tag:yaml.org,2002:seq",
    "tag:yaml.org,2002:str",
    "tag:yaml.org,2002:null",
    "tag:yaml.org,2002:bool",
    "tag:yaml.org,2002:int",
    "tag:yaml.org,2002:float",
]);

/** Parses only YAML's safe core schema; custom tags are rejected through document errors. */
export function parseYaml(source: string, filePath: string): unknown {
    const document = parseDocument(source, {
        schema: "core",
        strict: true,
        uniqueKeys: true,
    });

    const diagnostics = [...document.errors, ...document.warnings];
    if (diagnostics.length > 0) {
        throw CoachError.yamlParse(filePath, diagnostics.map((diagnostic) => diagnostic.message).join("; "));
    }

    let unsafeTag: string | undefined;
    visit(document, (_key, node) => {
        if (node !== null && typeof node === "object" && "tag" in node && typeof node.tag === "string" && !CORE_TAGS.has(node.tag)) {
            unsafeTag ??= node.tag;
        }
    });
    if (unsafeTag !== undefined) {
        throw CoachError.yamlParse(filePath, `non-core YAML tag "${unsafeTag}" is not allowed`);
    }

    return document.toJS();
}

/** Serializes the value shapes used by engine documents with the matching safe core schema. */
export function serializeYaml(value: unknown): string {
    return stringify(value, { schema: "core" });
}

type AtomicWriteOptions = {
    /** Test seam for simulating an interrupted write before the rename. */
    readonly writeFile?: typeof writeFile;
};

/**
 * Replaces a file atomically. The temporary file must share the target directory so rename is
 * atomic on the target filesystem rather than relying on cross-device temp-directory behavior.
 */
export async function writeFileAtomic(targetPath: string, content: string, options: AtomicWriteOptions = {}): Promise<void> {
    const directory = path.dirname(targetPath);
    const temporaryPath = path.join(directory, `.${path.basename(targetPath)}.${randomUUID()}.tmp`);
    const write = options.writeFile ?? writeFile;

    await mkdir(directory, { recursive: true });
    try {
        await write(temporaryPath, content, "utf8");
        await rename(temporaryPath, targetPath);
    } catch (error) {
        await rm(temporaryPath, { force: true });
        throw error;
    }
}
