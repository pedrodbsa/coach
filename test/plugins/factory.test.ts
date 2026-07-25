import { describe, expect, it } from "vitest";

import { createContext } from "../../src/context.ts";
import { PluginFactory } from "../../src/plugins/index.ts";
import { stubPlugin } from "../../src/plugins/stub.ts";
import { coachError } from "../support/errors.ts";

const io = { stdout: { write: () => {} }, stderr: { write: () => {} } };

describe("PluginFactory", () => {
    it("creates a registered plugin with namespace-bound storage", () => {
        const context = createContext("pedro", { io });
        const storageRequests: Array<{ namespace: string; tables: readonly string[] }> = [];
        const factory = new PluginFactory({
            create(namespace, tables = []) {
                storageRequests.push({ namespace, tables });
                return context.storage.create(namespace, tables);
            },
        });

        const plugin = factory.create("stub");

        expect(plugin.key).toBe("stub");
        expect(plugin.commands.summary.execute).toBeTypeOf("function");
        expect(plugin.commands.summary.synergies).toEqual([]);
        expect(storageRequests).toEqual([{ namespace: "stub", tables: stubPlugin.storeTables }]);
    });

    it("constructs anything in the registry — reachability is not its decision", () => {
        const context = createContext("pedro", { io });

        // No active set is supplied and none is consulted; compare the routing test in cli/coach.
        expect(new PluginFactory(context.storage).create("stub").key).toBe("stub");
    });

    it("rejects a namespace no plugin is registered under", () => {
        const context = createContext("pedro", { io });
        const factory = new PluginFactory(context.storage);

        expect(() => factory.create("cycling")).toThrow(coachError("UNREGISTERED_PLUGIN"));
        expect(() => factory.create("cycling")).toThrow(
            'no plugin is registered under the namespace "cycling"',
        );
    });
});
