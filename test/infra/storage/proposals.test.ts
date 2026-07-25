import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    StorageFactory,
    listProposals,
    previewProposal,
    promoteProposal,
    readProposal,
    recordProposalRound,
    rejectProposal,
    type StorageFactoryOptions,
} from "../../../src/infra/storage/index.ts";
import { coachError } from "../../support/errors.ts";

const PROFILE = "pedro";
const NAMESPACE = "running";
const FIXED = new Date("2026-07-23T06:00:00.000Z");

let dataRoot: string;
let policyRoot: string;
let options: StorageFactoryOptions;

function seed(root: string, relative: string, contents: string): string {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents, "utf8");
    return target;
}

const storage = () => new StorageFactory(PROFILE, options).create(NAMESPACE);
const livePolicy = () => path.join(dataRoot, "pedro/policy/running/zones.yaml");

beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), "coach-prop-data-"));
    policyRoot = mkdtempSync(path.join(tmpdir(), "coach-prop-policy-"));
    options = { dataRoot, policyRoot, clock: { now: () => FIXED } };
});

afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true });
    rmSync(policyRoot, { recursive: true, force: true });
});

describe("the proposal record", () => {
    it("captures the complete override, its rationale and the opening round", async () => {
        seed(policyRoot, "running/zones.yaml", "easy_cap: 145\n");
        seed(dataRoot, "pedro/policy/running/zones.yaml", "easy_cap: 142\n");

        const id = await storage().policy.propose(
            "zones",
            { easy_cap: 138 },
            { why: "easy runs sat 7bpm over the cap for six weeks", derivation: "…" },
        );
        const record = await readProposal(PROFILE, NAMESPACE, id, options);

        expect(record).toMatchObject({
            id,
            namespace: NAMESPACE,
            kind: "policy",
            document: "zones",
            proposed: { easy_cap: 138 },
            based_on: { easy_cap: 142 },
            created_at: FIXED.toISOString(),
        });
        expect(record?.rounds).toEqual([
            {
                at: FIXED.toISOString(),
                by: "specialist",
                verdict: "proposed",
                note: "easy runs sat 7bpm over the cap for six weeks",
            },
        ]);
    });

    it("records a null base when nothing is overridden yet", async () => {
        seed(policyRoot, "running/zones.yaml", "easy_cap: 145\n");

        const id = await storage().policy.propose("zones", { easy_cap: 138 }, { why: "x" });

        expect((await readProposal(PROFILE, NAMESPACE, id, options))?.based_on).toBeNull();
    });

    it("lists pending proposals oldest first, scoped to the namespace", async () => {
        let tick = 0;
        const advancing = { ...options, clock: { now: () => new Date(FIXED.getTime() + tick++ * 60_000) } };

        const factory = new StorageFactory(PROFILE, advancing);
        await factory.create(NAMESPACE).policy.propose("zones", { a: 1 }, { why: "one" });
        await factory.create(NAMESPACE).policy.propose("tiers", { b: 2 }, { why: "two" });
        await factory.create("nutrition").policy.propose("t", { c: 3 }, { why: "x" });

        expect((await listProposals(PROFILE, NAMESPACE, options)).map((p) => p.document)).toEqual([
            "zones",
            "tiers",
        ]);
        expect(await listProposals(PROFILE, "strength", options)).toEqual([]);
    });
});

describe("mediation rounds", () => {
    it("appends rather than overwriting, so the negotiation stays auditable", async () => {
        const id = await storage().policy.propose("zones", { easy_cap: 138 }, { why: "too easy" });

        await recordProposalRound(
            PROFILE,
            NAMESPACE,
            id,
            { at: "2026-07-23T07:00:00.000Z", by: "head-coach", verdict: "rejected", note: "too big a jump" },
            options,
        );
        await recordProposalRound(
            PROFILE,
            NAMESPACE,
            id,
            { at: "2026-07-23T07:05:00.000Z", by: "specialist", verdict: "refined", note: "141 instead" },
            options,
        );

        const record = await readProposal(PROFILE, NAMESPACE, id, options);
        expect(record?.rounds.map((round) => round.verdict)).toEqual([
            "proposed",
            "rejected",
            "refined",
        ]);
    });

    it("throws a named error for an unknown proposal", async () => {
        await expect(
            recordProposalRound(
                PROFILE,
                NAMESPACE,
                "nope",
                { at: "x", by: "athlete", verdict: "approved", note: "" },
                options,
            ),
        ).rejects.toThrow(coachError("PROPOSAL_NOT_FOUND"));
    });
});

describe("the approval diff", () => {
    it("returns both sides merged over the shipped defaults", async () => {
        seed(policyRoot, "running/zones.yaml", "easy_cap: 145\nthreshold: 172\n");
        seed(dataRoot, "pedro/policy/running/zones.yaml", "easy_cap: 142\n");

        const id = await storage().policy.propose("zones", { easy_cap: 138 }, { why: "x" });

        expect(await previewProposal(PROFILE, NAMESPACE, id, options)).toEqual({
            current: { easy_cap: 142, threshold: 172 },
            proposed: { easy_cap: 138, threshold: 172 },
        });
    });

    it("falls back to the defaults alone when nothing is overridden", async () => {
        seed(policyRoot, "running/zones.yaml", "easy_cap: 145\n");

        const id = await storage().policy.propose("zones", { easy_cap: 138 }, { why: "x" });

        expect(await previewProposal(PROFILE, NAMESPACE, id, options)).toEqual({
            current: { easy_cap: 145 },
            proposed: { easy_cap: 138 },
        });
    });
});

describe("promotion — the only writer of data/<profile>/policy/", () => {
    it("replaces the override, logs the coaching row, and clears the proposal", async () => {
        seed(policyRoot, "running/zones.yaml", "easy_cap: 145\nthreshold: 172\n");
        const id = await storage().policy.propose(
            "zones",
            { easy_cap: 138 },
            { why: "easy runs sat 7bpm over the cap" },
        );

        const result = await promoteProposal(PROFILE, NAMESPACE, id, options);

        expect(result).toEqual({
            proposal: id,
            namespace: NAMESPACE,
            kind: "policy",
            document: "zones",
            promoted_at: FIXED.toISOString(),
        });
        expect(readFileSync(livePolicy(), "utf8")).toContain("easy_cap: 138");
        expect(await storage().policy.read("zones")).toEqual({ easy_cap: 138, threshold: 172 });
        expect(await listProposals(PROFILE, NAMESPACE, options)).toEqual([]);

        const [row] = await storage().history.recent(5);
        expect(row).toMatchObject({
            at: FIXED.toISOString(),
            kind: "proposal.promoted",
            by: NAMESPACE,
            summary: "easy runs sat 7bpm over the cap",
            payload: { proposal: id, document: "zones", steerable: "policy", rounds: 1 },
        });
    });

    it("promotes a profile document to the profile kind, not to policy", async () => {
        const id = await storage().profile.propose("gym", { rack: true }, { why: "new gym" });

        await promoteProposal(PROFILE, NAMESPACE, id, options);

        expect(await storage().profile.read("gym")).toEqual({ rack: true });
        expect(existsSync(livePolicy())).toBe(false);
    });

    it("refuses a stale proposal rather than reverting what landed since", async () => {
        seed(dataRoot, "pedro/policy/running/zones.yaml", "easy_cap: 142\n");
        const id = await storage().policy.propose("zones", { easy_cap: 138 }, { why: "x" });

        // Something else was promoted while this proposal sat waiting for approval.
        writeFileSync(livePolicy(), "easy_cap: 140\n", "utf8");

        await expect(promoteProposal(PROFILE, NAMESPACE, id, options)).rejects.toThrow(
            coachError("PROPOSAL_STALE"),
        );
        expect(readFileSync(livePolicy(), "utf8")).toBe("easy_cap: 140\n");
        expect(await listProposals(PROFILE, NAMESPACE, options)).toHaveLength(1);
    });

    it("throws a named error for an unknown proposal", async () => {
        await expect(promoteProposal(PROFILE, NAMESPACE, "nope", options)).rejects.toThrow(
            coachError("PROPOSAL_NOT_FOUND"),
        );
    });

    it("replaces the override wholesale — a proposal is a document, not a patch", async () => {
        seed(dataRoot, "pedro/policy/running/zones.yaml", "easy_cap: 142\nthreshold: 170\n");
        const id = await storage().policy.propose("zones", { easy_cap: 138 }, { why: "x" });

        await promoteProposal(PROFILE, NAMESPACE, id, options);

        expect(await storage().policy.layers("zones")).toEqual({
            defaults: null,
            overrides: { easy_cap: 138 },
        });
    });
});

describe("rejection", () => {
    it("removes the proposal and changes nothing live", async () => {
        seed(dataRoot, "pedro/policy/running/zones.yaml", "easy_cap: 142\n");
        const id = await storage().policy.propose("zones", { easy_cap: 138 }, { why: "x" });

        await rejectProposal(PROFILE, NAMESPACE, id, options);

        expect(await listProposals(PROFILE, NAMESPACE, options)).toEqual([]);
        expect(readFileSync(livePolicy(), "utf8")).toBe("easy_cap: 142\n");
    });
});

describe("a proposal file that is not a proposal", () => {
    // Proposals are YAML under git that a human can open and edit. Reading one back is a trust
    // boundary, so a malformed record fails by name here rather than reaching `promoteProposal`
    // and writing a live coaching rule from fields that were never validated.
    it("is refused by name rather than promoted", async () => {
        seed(dataRoot, "pedro/proposals/running/zones.hand-edited.yaml", "easy_cap: 138\n");

        await expect(listProposals(PROFILE, NAMESPACE, options)).rejects.toThrow(
            coachError("PROPOSAL_MALFORMED"),
        );
    });

    it("is refused when a field promotion depends on is the wrong shape", async () => {
        const id = await storage().policy.propose("zones", { easy_cap: 138 }, { why: "drift" });
        const file = path.join(dataRoot, `pedro/proposals/running/zones.${id}.yaml`);
        writeFileSync(file, readFileSync(file, "utf8").replace("kind: policy", "kind: nonsense"));

        await expect(promoteProposal(PROFILE, NAMESPACE, id, options)).rejects.toThrow(
            coachError("PROPOSAL_MALFORMED"),
        );
    });
});
