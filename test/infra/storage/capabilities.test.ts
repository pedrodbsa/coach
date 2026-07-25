import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { StorageFactory } from "../../../src/infra/storage/index.ts";

/**
 * The contract's enforcement mechanism (§1.5): **nothing reachable from a plugin can change live
 * policy.** There is no privileged variant to escalate to — promotion lives outside this surface
 * entirely, in the core-only `promoteProposal`.
 *
 * These assert on the handles a plugin is actually handed, at runtime. The previous version of
 * this file asserted the same thing against the *type* declarations under a second tsconfig and a
 * separate vitest typecheck mode; the compiler already rejects a call to a method that isn't
 * declared, so that only restated the type definitions. What is worth pinning is that the objects
 * built by `factory.ts` carry exactly the methods the contract allows — a `write` added to the
 * wrong base class would slip past a type-level assertion about the interfaces.
 */

let dataRoot: string;
let policyRoot: string;

function storage() {
    return new StorageFactory("pedro", { dataRoot, policyRoot }).create("stub");
}

/** `in` walks the prototype chain, so an inherited method counts — which is the point here. */
function capabilities(handle: object): string[] {
    const names = new Set<string>();
    for (let o = handle; o !== null && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
        for (const name of Object.getOwnPropertyNames(o)) {
            if (name !== "constructor") names.add(name);
        }
    }
    return [...names].sort();
}

beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), "coach-caps-data-"));
    policyRoot = mkdtempSync(path.join(tmpdir(), "coach-caps-policy-"));
});

afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true });
    rmSync(policyRoot, { recursive: true, force: true });
});

describe("Storage — the handle every plugin verb receives", () => {
    it("exposes policy as read + list + layers + propose, with no writer", () => {
        expect(capabilities(storage().policy)).toEqual(["layers", "list", "propose", "read"]);
    });

    it("exposes profile as read + list + propose, with no writer", () => {
        expect(capabilities(storage().profile)).toEqual(["list", "propose", "read"]);
    });

    it("exposes state as read + list + write — actions own it outright, nothing to propose", () => {
        expect(capabilities(storage().state)).toEqual(["list", "read", "write"]);
    });

    it("exposes the logbook read-only — no write and nothing to propose", () => {
        expect(capabilities(storage().logbook)).toEqual(["list", "read"]);
    });

    it("exposes history as append + recent — no overwrite, delete, or eviction", () => {
        expect(capabilities(storage().history)).toEqual(["append", "recent"]);
    });

    it("binds exactly one namespace and offers no way to name another", () => {
        const store = storage();
        expect(store.namespace).toBe("stub");
        for (const escape of ["forPlugin", "resolve", "promote", "binding"]) {
            expect(escape in store).toBe(false);
        }
    });

    it("refuses to have a handle swapped for one that writes", () => {
        const store = storage();
        expect(Object.isFrozen(store)).toBe(true);
        expect(() => {
            (store as unknown as Record<string, unknown>).policy = { write: () => {} };
        }).toThrow(TypeError);
    });
});
