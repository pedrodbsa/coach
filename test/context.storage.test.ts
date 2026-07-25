import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createContext, type CoachDeps } from "../src/context.ts";
import { coachError } from "./support/errors.ts";

let dataRoot: string;
let policyRoot: string;

function deps(overrides: Partial<CoachDeps> = {}): CoachDeps {
    return {
        io: { stdout: { write: () => {} }, stderr: { write: () => {} } },
        env: {},
        dataRoot,
        policyRoot,
        ...overrides,
    };
}

function seed(root: string, relative: string, contents: string): void {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents, "utf8");
}

beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), "coach-ctx-data-"));
    policyRoot = mkdtempSync(path.join(tmpdir(), "coach-ctx-policy-"));
});

afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true });
    rmSync(policyRoot, { recursive: true, force: true });
});

describe("ctx.storage", () => {
    it("binds the context's already-validated profile", async () => {
        seed(dataRoot, "pedro/state/stub/today.yaml", "who: pedro\n");
        seed(dataRoot, "partner/state/stub/today.yaml", "who: partner\n");

        const ctx = createContext("pedro", deps());

        expect(await ctx.storage.create("stub").state.read("today")).toEqual({ who: "pedro" });
    });

    it("resolves the shipped policy root the context was given", async () => {
        seed(policyRoot, "stub/rules.yaml", "cap: 3\n");

        expect(await createContext("pedro", deps()).storage.create("stub").policy.read("rules")).toEqual({
            cap: 3,
        });
    });

    it("rejects a crafted namespace at the point of asking", () => {
        const ctx = createContext("pedro", deps());

        expect(() => ctx.storage.create("../partner")).toThrow(coachError("PROFILE_SCOPE_VIOLATION"));
    });

    it("is additive — resolve still works for core commands", () => {
        const ctx = createContext("pedro", deps());

        expect(ctx.resolve("store", "metrics.db")).toBe(
            path.join(dataRoot, "pedro", "store", "metrics.db"),
        );
    });
});
