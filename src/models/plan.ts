/**
 * The daily artifact as typed structures, plus the one runtime validator that decides whether a
 * specialist's JSON is something the CLI is willing to persist (design §6; plan Chunk 3).
 *
 * Two things this file is, that are easy to miss:
 *
 * 1. **It is the field-name contract.** The specialists (Chunks 5–6), the head coach (7),
 *    `garmin.push` (8), the logging channel (9), the extractor (4) and the web app (12) all read
 *    these names. The block names come verbatim from the prototype
 *    (`.scratch/coach-remote/prototypes/2026-07-22.plan.yaml`); the 2026-07-25 fields are added on
 *    top of it (`petitions[]`, `decision.brief`, `accept`, `action_id`, and `at`/`occurred`/`mode`).
 * 2. **It is the sole-writer gate.** An agent never edits the plan file: it emits JSON, this
 *    validates it, and Chunk 3.2 persists YAML. So the checks below are the only thing standing
 *    between an agent's invention and the athlete's day, which is why an unrecognised key is a hard
 *    violation rather than a field that quietly rides along.
 *
 * `validatePlan` returns every violation it found, hard and warn, in the shape the Global
 * Constraints fix (`models/validation.ts`). What is deliberately *not* here: persistence (3.2), the
 * `schema_version` mismatch failure (3.5), the brief itself (Chunk 4), any domain's `validate`
 * *content* (5–6), and defaulting a log entry's `mode` from the action window (9).
 */

import {
    describeValue,
    Violations,
    type ValidationResult,
} from "./validation.ts";

// ── Scalars ─────────────────────────────────────────────────────────────────────────────────────

/** `2026-07-22`. A calendar date, checked as one — not a `Date`: the file is the canonical form. */
export type IsoDate = string;
/** `2026-07-22T06:12:00Z`. Zone required — a staleness comparison on a floating time is arithmetic
 * on an unknown. */
export type IsoTimestamp = string;
/** `12:00`, 24-hour. The athlete's local wall clock; the action window derives from it (Chunk 9). */
export type ClockTime = string;

/**
 * JSON as it appears in a plan file. Used for the two nodes whose *keys* another chunk owns — a
 * module's `validate` block and the brief's `markers` — so this schema can check that they are data
 * without pretending to know their vocabulary.
 */
export type PlanValue =
    | string
    | number
    | boolean
    | null
    | readonly PlanValue[]
    | { readonly [key: string]: PlanValue };

// ── Action identity (amendments §6.2 — core owns it) ─────────────────────────────────────────────

/**
 * `<date>:<module>:<slot>` — the handle a log entry, a nudge or a reconciliation targets.
 *
 * Minted from **position**, never from content, and that is the whole design. An id derived from the
 * prescription (a hash of the meal's items, say) would change the moment the athlete says "chicken
 * instead of beef": the `amend` re-derives the meal, the id moves, and the log row that pointed at it
 * is orphaned — every pre-fact correction losing its own history. Date, module and slot all survive
 * an amendment, so re-deriving the day reproduces the same ids.
 */
export type ActionId = string;

/** The parts of an {@link ActionId}. `slot` is the meal's `id`, or `session` for a session. */
export interface ActionIdParts {
    readonly date: IsoDate;
    readonly module: string;
    readonly slot: string;
}

/** The slot of a module's single prescribed session. */
export const SESSION_SLOT = "session";

const ACTION_ID_PART = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/**
 * The only constructor for an {@link ActionId}. A malformed part is a `RangeError`, not a violation:
 * a caller composing an id out of a slot with a colon in it is a bug in the code, not a condition
 * the athlete can act on.
 */
export function makeActionId(parts: ActionIdParts): ActionId {
    for (const [name, part] of Object.entries(parts)) {
        if (!ACTION_ID_PART.test(part)) {
            throw new RangeError(`action id ${name} "${part}" is not a single safe segment`);
        }
    }
    return `${parts.date}:${parts.module}:${parts.slot}`;
}

/** The inverse, or `null` when the string is not an action id at all. */
export function parseActionId(id: string): ActionIdParts | null {
    const parts = id.split(":");
    if (parts.length !== 3 || !parts.every((part) => ACTION_ID_PART.test(part))) {
        return null;
    }
    const [date, module, slot] = parts as [string, string, string];
    return { date, module, slot };
}

// ── The head coach's decision ───────────────────────────────────────────────────────────────────

/**
 * What "done" looks like **in the head coach's terms**, so the domain's `validate` has something
 * external to check against and the head coach can judge delivery without reading domain internals
 * (amendments §1.3, §6.2).
 *
 * Structured, not a sentence, and that is the load-bearing choice: the prose rule (§2.3) says
 * nothing a validator checks may live only in prose, and this field exists *to be checked*. A
 * free-text "hit the protein floor" would be unreachable by the domain that has to satisfy it and by
 * `coach head validate` (Chunk 7.5), which asserts every intent carries a condition some domain can
 * actually evaluate. The `why` is for the athlete; it may sit beside the clauses, never instead.
 */
export interface AcceptanceCondition {
    /** Every clause must hold. A disjunction is expressed as one `in` clause, so there is one form. */
    readonly all: readonly AcceptanceClause[];
    readonly why?: string;
}

/** The operators a domain must be able to evaluate. No `between`: two clauses say it unambiguously. */
export const ACCEPTANCE_OPS = ["==", "!=", ">=", "<=", ">", "<", "in", "not_in"] as const;
export type AcceptanceOp = (typeof ACCEPTANCE_OPS)[number];

export interface AcceptanceClause {
    /** The observable, in head-coach vocabulary: `protein_g`, `intensity.hard_effort`. */
    readonly metric: string;
    readonly op: AcceptanceOp;
    /** A scalar for the comparisons, a list for `in` / `not_in`. */
    readonly value: PlanValue;
    readonly unit?: string;
}

/** A policy rule that fired, by identifier — 7.5 checks the identifier exists in policy. */
export interface RuleFired {
    readonly rule: string;
    /** One sentence: what in the data made it fire. */
    readonly because?: string;
    /** The machine-readable consequences, in head-coach vocabulary. */
    readonly effect?: readonly string[];
}

/**
 * One module's ticket for the day: the *what*, its acceptance criteria, and its edges.
 *
 * **There is no `tier`.** The prototype had the head coach prescribing
 * `tier: phase5_easy_strength` — a nutrition internal, named by the party that is not allowed to
 * know it (amendments §1.1, §7: the domain owns the *how*). It is not renamed or relocated: it is
 * *replaced* by {@link accept}. The head coach states the floors it cares about (`protein_g >= 170`,
 * `kcal_delta_pct <= 5`) and nutrition picks the tier that meets them, recording its choice in its
 * own block as `nutrition.tier.name`. So the boundary the next four chunks lean on holds in both
 * directions: nothing here names a domain internal, and the domain still has something external and
 * checkable to satisfy. The validator refuses `tier` as an unknown key rather than ignoring it,
 * because a head coach regressing to it is exactly the drift this field exists to prevent.
 */
export interface Prescription {
    /** An active plugin's namespace. 7.5 checks it is one. */
    readonly module: string;
    /** The *what*, never the *how* — a policy-defined intent token the domain interprets. */
    readonly intent: string;
    readonly accept: AcceptanceCondition;
    /** One sentence. */
    readonly because?: string;
    /** Per-day edges the workflow runner topo-sorts (Chunk 7.3). */
    readonly depends_on?: readonly string[];
}

/** Which brief this decision was made against (amendments §3.3). Chunk 4 produces the timestamp. */
export interface BriefProvenance {
    readonly computed_at: IsoTimestamp;
}

export interface Decision {
    /** The day's shape as the head coach names it. */
    readonly day_type: string;
    /** The readiness verdict as a token, from the head coach's policy vocabulary. */
    readonly readiness: string;
    /**
     * Required. Without it "was this decided on stale premises" is unanswerable from the artifacts,
     * which is the one question drift control needs the plan file to answer after the fact.
     */
    readonly brief: BriefProvenance;
    readonly why?: string;
    readonly rules_fired?: readonly RuleFired[];
    readonly prescribes: readonly Prescription[];
}

// ── Petitions (contract §6.3, §6.7) ─────────────────────────────────────────────────────────────

/**
 * A coach's request for cross-domain influence, addressed to the head coach and to nobody else.
 *
 * It lives on the module block rather than in state because it is mediated on a *later* decision
 * (§6.4) and the plan file is what git keeps. **There is no `target`.** A routed work item is one
 * refactor away from being a cross-domain command, which is the thing the whole storage design
 * prevents — so `target` is not merely absent from the type, the validator rejects it.
 */
export interface Petition {
    /** The petitioning namespace, set by the runner from the emitting step — never by the coach. */
    readonly from: string;
    /** A capability or a priority, one sentence. Never a prescription, never a domain internal. */
    readonly need: string;
    readonly why: string;
    readonly horizon?: PetitionHorizon;
}

export const PETITION_HORIZONS = ["today", "this_week", "this_block"] as const;
export type PetitionHorizon = (typeof PETITION_HORIZONS)[number];

// ── Logged entries and `actual` (amendments §6.1, §6.3, §6.4) ───────────────────────────────────

/**
 * `amend` is before the fact — the prescription changes and `reconcile` later compares against the
 * amended one. `report` is after — the plan stands and the outcome differed. Collapsing them either
 * makes a compliant athlete read as non-compliant or lets the plan rewrite itself to match reality.
 */
export type LogMode = "amend" | "report";
export const LOG_MODES = ["amend", "report"] as const;

export interface LogEntry {
    /** The action this is about. Core resolves it; the athlete never types one. */
    readonly action_id: ActionId;
    /** When it was said, from the run's clock. */
    readonly at: IsoTimestamp;
    /** When the thing happened, or will happen. Chunk 9 defaults `mode` by comparing the two. */
    readonly occurred: IsoTimestamp;
    readonly mode: LogMode;
    /** The delta only — "no beef, chicken" never restates the meal (§6.4). */
    readonly delta?: { readonly [key: string]: PlanValue };
    /** The athlete's own words, kept beside the parsed delta so a mis-parse stays recoverable. */
    readonly said?: string;
}

/**
 * What is known about a module's day so far. Absent or `null` means *nothing yet* — and that is a
 * state, not a zero. Present means at least one signal arrived, so `{}` and `{ entries: [] }` are
 * both refused: an empty container standing in for silence is how `unknown` decays into `skipped`.
 */
export interface ModuleActual {
    /** Append-only, in the order it was said. Corrections append; nothing rewrites. */
    readonly entries?: readonly LogEntry[];
    /** Hard data (Garmin). Observed wins over reported for what it can see (§6.1). */
    readonly observed?: { readonly [key: string]: PlanValue } | null;
}

// ── Running ─────────────────────────────────────────────────────────────────────────────────────

/**
 * `hr` or `pace` and nothing else: every step, warmup and cooldown included, carries a target the
 * watch can be pushed (design §6, decisions 02/01). An RPE-only step is not pushable, so it is not a
 * target — Chunk 6's `every_step_has_target` is the check, and this is the vocabulary it checks.
 */
export type RunTarget = HrTarget | PaceTarget;

export interface HrTarget {
    readonly type: "hr";
    readonly min?: number;
    readonly max?: number;
}

export interface PaceTarget {
    readonly type: "pace";
    /** `mm:ss` per km. */
    readonly min_per_km?: string;
    readonly max_per_km?: string;
}

export interface RunStep {
    readonly kind: string;
    readonly distance_km?: number | null;
    readonly duration_min?: number | null;
    /** Nullable so a targetless step is *representable* — and, being detectable, reportable. */
    readonly target: RunTarget | null;
    readonly incline_pct?: number | null;
    readonly repeat?: number;
    readonly why?: string;
    readonly note?: string;
}

/** Whether the watch gets this session, and the id Garmin gave it once pushed (Chunk 8). */
export interface GarminPush {
    readonly push: boolean;
    readonly workout_id?: string | number | null;
}

export interface RunComparison {
    readonly date: IsoDate;
    readonly avg_hr?: number | null;
    readonly pace_per_km?: string | null;
    readonly distance_km?: number | null;
}

export interface RunSession {
    readonly action_id: ActionId;
    readonly kind: string;
    readonly start: ClockTime | null;
    readonly steps: readonly RunStep[];
    readonly location?: string | null;
    readonly rpe?: string | null;
    readonly compare_to?: RunComparison | null;
    readonly garmin?: GarminPush | null;
    readonly why?: string;
    readonly note?: string;
}

// ── Strength ────────────────────────────────────────────────────────────────────────────────────

/**
 * Reps in the three shapes the athlete's programme actually uses, kept as three
 * (design §6): `[10, 10, 10, 8]` is a per-set prescription, `{ min: 10, max: 12 }` is a range to
 * work inside, `{ value: 12, per: "side" }` is a per-side count. Normalising them into one would
 * either invent per-set numbers the coach did not prescribe or lose the per-side doubling that the
 * volume arithmetic and the Garmin push both need.
 */
export type Reps = readonly number[] | RepRange | RepsPerSide;
export type RepsShape = "per_set" | "range" | "per_side";

export interface RepRange {
    readonly min: number;
    readonly max: number;
}

export interface RepsPerSide {
    readonly value: number;
    readonly per: PerSide;
}

export const PER_SIDES = ["side", "hand", "leg", "arm"] as const;
export type PerSide = (typeof PER_SIDES)[number];

/** Which of the three a value is, or `null` if it is none of them. The consumer's narrowing seam. */
export function repsShape(reps: unknown): RepsShape | null {
    if (Array.isArray(reps)) {
        return reps.length > 0 && reps.every((count) => typeof count === "number") ? "per_set" : null;
    }
    if (!isRecord(reps)) {
        return null;
    }
    if (typeof reps.min === "number" && typeof reps.max === "number") {
        return "range";
    }
    if (typeof reps.value === "number" && typeof reps.per === "string") {
        return "per_side";
    }
    return null;
}

export const LOAD_UNITS = ["kg", "lb", "bodyweight"] as const;
export type LoadUnit = (typeof LOAD_UNITS)[number];

export interface Load {
    /** `null` is an *unresolved* load — representable, and detected as a violation. */
    readonly value: number | null;
    readonly unit: LoadUnit;
    readonly per?: PerSide;
}

/** The enums `garmin.push` needs so it can fire on approval with no agent step (Chunk 8). */
export interface GarminMovement {
    readonly category: string | null;
    readonly exercise_name: string | null;
    readonly status: GarminEnumStatus;
}

/** `verified` — the pair round-tripped a Garmin read-back. `free_entry` — no enum exists for it. */
export const GARMIN_ENUM_STATUSES = ["verified", "free_entry"] as const;
export type GarminEnumStatus = (typeof GARMIN_ENUM_STATUSES)[number];

export interface Movement {
    /** The programme slot this fills — stable across exercise substitution. */
    readonly slot: string;
    readonly exercise: string;
    readonly sets: number;
    readonly reps?: Reps | null;
    readonly load: Load | null;
    readonly distance_m?: number | null;
    readonly per?: PerSide;
    readonly rest_s?: number | null;
    readonly garmin?: GarminMovement | null;
    readonly why?: string;
    readonly note?: string;
}

export interface StrengthSession {
    readonly action_id: ActionId;
    readonly kind: string;
    readonly start: ClockTime | null;
    readonly movements: readonly Movement[];
    readonly location?: string | null;
    readonly rpe?: string | null;
    /** When this block session last ran — the rotation the head coach weighed. */
    readonly rotated_off?: IsoDate | null;
    readonly constraints?: readonly string[];
    readonly garmin?: GarminPush | null;
    readonly why?: string;
    readonly note?: string;
}

// ── Nutrition ───────────────────────────────────────────────────────────────────────────────────

export interface NutritionTier {
    /** The tier the *domain* chose. The head coach states floors, never a tier name. */
    readonly name: string;
    readonly kcal: number | null;
    readonly protein_g: number | null;
    readonly carb_g: number | null;
    readonly fat_g: number | null;
    readonly why?: string;
}

export interface Macros {
    readonly kcal: number | null;
    readonly p: number | null;
    readonly c: number | null;
    readonly f: number | null;
}

export interface MealItem {
    /** A food-table key (Chunk 5 resolves it), so spaces are legal: `olive oil`. */
    readonly food: string;
    readonly qty?: number | null;
    readonly unit?: string | null;
    readonly when?: "before" | "with" | "after";
    readonly state?: string;
    readonly note?: string;
}

/**
 * `planned` is the prescription as decided; `amended` says a pre-fact log changed it. There is no
 * `eaten` — an outcome is a `report` under `actual`, and letting one land here would rewrite the
 * prescription to match reality, which is the failure §6.3 names.
 */
export const MEAL_STATUSES = ["planned", "amended"] as const;
export type MealStatus = (typeof MEAL_STATUSES)[number];

export interface Meal {
    /** The slot: `breakfast`, `pre_training`. Stable, and the `slot` half of the `action_id`. */
    readonly id: string;
    readonly action_id: ActionId;
    readonly at: ClockTime | null;
    readonly items: readonly MealItem[];
    readonly macros: Macros | null;
    readonly status: MealStatus;
    readonly label?: string;
    /** Medication this meal carries — `isotretinoin` with the fattiest meal. */
    readonly carries?: readonly string[];
    readonly why?: string;
    readonly note?: string;
}

export interface NutritionTotals {
    readonly expected: Macros | null;
    readonly projected: Macros | null;
    /** `null` until something is logged. Never `0` — nothing eaten yet is not zero eaten. */
    readonly actual: Macros | null;
}

// ── The blocks and the file ─────────────────────────────────────────────────────────────────────

/** Every module block carries these three, whatever the domain (design §6, decision 25). */
export interface ModuleBlock {
    /** Raised by this block's coach, for the head coach, on a later decision. */
    readonly petitions?: readonly Petition[];
    /**
     * The checks the domain ran, in the domain's own vocabulary. Its *content* is Chunks 5–6's; this
     * schema only holds it to being data, so nothing mechanical hides in a sentence here.
     */
    readonly validate?: { readonly [rule: string]: PlanValue };
    readonly actual?: ModuleActual | null;
}

export interface RunningBlock extends ModuleBlock {
    readonly session: RunSession | null;
}

export interface StrengthBlock extends ModuleBlock {
    readonly session: StrengthSession | null;
}

export interface NutritionBlock extends ModuleBlock {
    readonly tier: NutritionTier | null;
    readonly meals: readonly Meal[];
    readonly totals?: NutritionTotals | null;
}

/** A cross-cutting annotation. `code` is the part a rule or a query matches; `detail` is prose. */
export interface PlanFlag {
    readonly code: string;
    readonly detail?: string;
    /** The namespace that raised it. */
    readonly by?: string;
}

/**
 * The plan file. One block per module, the head coach and the brief at root.
 *
 * The three domain blocks are named because Chunks 5–8 and 12 read them by name. A fourth domain
 * with a plan block is an additive edit here — the validator only *warns* on a root block it does
 * not know, so a plan written by a build that has one still reads.
 */
export interface Plan {
    /** A string, not a float: `0.2` and `"0.20"` must stay distinguishable (3.5 pins the value). */
    readonly schema_version: string;
    readonly date: IsoDate;
    readonly profile: string;
    readonly title: string;
    readonly decision: Decision;
    /** The brief's facts, never verdicts. Chunk 4 owns their vocabulary and their `as_of`. */
    readonly markers: { readonly [fact: string]: PlanValue };
    readonly running?: RunningBlock;
    readonly strength?: StrengthBlock;
    readonly nutrition?: NutritionBlock;
    readonly flags?: readonly PlanFlag[];
}

// ── The validator ───────────────────────────────────────────────────────────────────────────────

const ROOT_KEYS = ["schema_version", "date", "profile", "title", "decision", "markers", "flags"] as const;
const MODULE_KEYS = ["running", "strength", "nutrition"] as const;

const TOKEN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/;
const UPPER_TOKEN = /^[A-Z][A-Z0-9_]*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** One line, one sentence's worth. Past this a `why` is a derivation, and derivations regrow. */
const WHY_CAP = 200;

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A collected action, so uniqueness and log targeting can be checked once the whole file is walked. */
interface SeenAction {
    readonly id: ActionId;
    readonly path: string;
    readonly derived: ActionId | null;
}

/**
 * Validates an untrusted value — a specialist's JSON, or YAML read back off disk — against the
 * schema above.
 *
 * Every violation is collected, not just the first: the workflow runner re-runs a failed step once
 * before escalating, so a validator that reported one complaint at a time would spend an agent call
 * per field. `ok` is derived from the severities in `Violations.resolve`.
 */
export function validatePlan(value: unknown): ValidationResult<Plan> {
    const found = new Violations();
    const walk = new PlanWalk(found);
    walk.plan(value);
    return found.resolve(value as Plan);
}

/**
 * The walk itself. A class only to carry the two things every check needs — the collector and the
 * cross-cutting state (`date` for deriving action ids, the actions seen so far) — instead of
 * threading them through thirty signatures.
 */
class PlanWalk {
    private date: IsoDate | null = null;
    private readonly actions: SeenAction[] = [];
    private readonly logTargets: { readonly id: ActionId; readonly path: string }[] = [];

    constructor(private readonly found: Violations) {}

    plan(value: unknown): void {
        const root = this.record("plan", value);
        if (root === null) {
            return;
        }

        // `schema_version` first and by type: the float the prototype shipped is the failure 3.5's
        // comparison would otherwise inherit.
        if (root.schema_version === undefined) {
            this.found.hard("schema_version.required", "string", "missing");
        } else if (typeof root.schema_version !== "string") {
            this.found.hard("schema_version.type", "string", describeValue(root.schema_version));
        }

        this.date = this.dateField("", root, "date", { required: true });
        this.text("", root, "profile", { required: true });
        this.text("", root, "title", { required: true });
        this.markers(root.markers);
        const prescribed = this.decision(root.decision);

        for (const key of MODULE_KEYS) {
            if (root[key] === undefined) {
                continue;
            }
            const block = this.record(key, root[key]);
            if (block === null) {
                continue;
            }
            if (key === "nutrition") {
                this.nutritionBlock(key, block);
            } else {
                this.sessionBlock(key, block);
            }
        }

        // A block for a domain this build has no types for: warn, never fail. The alternative makes
        // every future plugin's first plan file unreadable by the build that is running now.
        const knownRootKeys = [...ROOT_KEYS, ...MODULE_KEYS] as readonly string[];
        for (const key of Object.keys(root)) {
            if (!knownRootKeys.includes(key)) {
                this.found.warn("plan.unknown_block", `one of: ${MODULE_KEYS.join(", ")}`, key);
            }
        }

        this.flags(root.flags);
        this.deliveries(prescribed, root);
        this.actionIdentity();
    }

    // ── decision ────────────────────────────────────────────────────────────────────────────────

    /** Returns the modules the decision prescribed, so delivery can be checked against them. */
    private decision(value: unknown): string[] {
        const decision = this.record("decision", value, { required: true });
        if (decision === null) {
            return [];
        }
        this.keys("decision", decision, [
            "day_type",
            "readiness",
            "brief",
            "why",
            "rules_fired",
            "prescribes",
        ]);

        this.text("decision", decision, "day_type", { required: true });
        this.token("decision", decision, "readiness", { required: true });
        this.why("decision", decision);

        const brief = this.record("decision.brief", decision.brief, { required: true });
        if (brief !== null) {
            this.keys("decision.brief", brief, ["computed_at"]);
            this.timestamp("decision.brief", brief, "computed_at", { required: true });
        }

        for (const [index, entry] of this.each("decision.rules_fired", decision.rules_fired).entries()) {
            const path = `decision.rules_fired[${index}]`;
            const fired = this.record(path, entry);
            if (fired === null) {
                continue;
            }
            this.keys(path, fired, ["rule", "because", "effect"]);
            this.token(path, fired, "rule", { required: true });
            this.text(path, fired, "because", { line: true });
            this.tokenList(`${path}.effect`, fired.effect);
        }

        const prescribes = this.list("decision.prescribes", decision.prescribes, { required: true });
        const modules: string[] = [];
        for (const [index, entry] of prescribes.entries()) {
            const module = isRecord(entry) && typeof entry.module === "string" ? entry.module : String(index);
            const path = `decision.prescribes[${module}]`;
            const prescription = this.record(path, entry);
            if (prescription === null) {
                continue;
            }
            this.keys(path, prescription, ["module", "intent", "accept", "because", "depends_on"]);
            this.token(path, prescription, "module", { required: true });
            this.token(path, prescription, "intent", { required: true });
            this.text(path, prescription, "because", { line: true });
            this.tokenList(`${path}.depends_on`, prescription.depends_on);
            this.accept(path, prescription.accept);
            if (typeof prescription.module === "string") {
                modules.push(prescription.module);
            }
        }

        // Two intents for one module leave the domain to pick, which is the head coach's call to
        // make. It is also the one duplication a per-module path cannot report on its own.
        const counted = new Map<string, number>();
        for (const module of modules) {
            counted.set(module, (counted.get(module) ?? 0) + 1);
        }
        for (const [module, count] of counted) {
            if (count > 1) {
                this.found.hard(
                    "decision.prescribes.one_per_module",
                    "one intent per module",
                    `${module} prescribed ${count} times`,
                );
            }
        }
        return [...counted.keys()];
    }

    /** The prose rule's one enforcement point in this chunk (see {@link AcceptanceCondition}). */
    private accept(path: string, value: unknown): void {
        if (value === undefined || value === null) {
            this.found.hard(
                `${path}.accept.required`,
                "a structured acceptance condition the domain can check",
                describeValue(value),
            );
            return;
        }

        const accept = isRecord(value) ? value : null;
        const clauses = accept !== null && Array.isArray(accept.all) ? accept.all : [];
        if (accept === null || clauses.length === 0) {
            this.found.hard(
                `${path}.accept.structured`,
                "an acceptance condition as `all: [{ metric, op, value }]` — a sentence is unreachable " +
                    "by every check that consumes it",
                describeValue(value),
            );
            if (accept === null) {
                return;
            }
        }
        this.keys(`${path}.accept`, accept, ["all", "why"]);
        this.why(`${path}.accept`, accept);

        for (const [index, entry] of clauses.entries()) {
            const clausePath = `${path}.accept.all[${index}]`;
            const clause = this.record(clausePath, entry);
            if (clause === null) {
                continue;
            }
            this.keys(clausePath, clause, ["metric", "op", "value", "unit"]);
            this.token(clausePath, clause, "metric", { required: true });
            this.token(clausePath, clause, "unit", {});

            const op = clause.op;
            if (op === undefined || op === null) {
                this.hard(`${clausePath}.op.required`, ACCEPTANCE_OPS.join(" | "), op, { required: true });
            } else if (typeof op !== "string" || !(ACCEPTANCE_OPS as readonly string[]).includes(op)) {
                this.found.hard(`${clausePath}.op.enum`, ACCEPTANCE_OPS.join(" | "), describeValue(op));
            }

            if (clause.value === undefined) {
                this.found.hard(`${clausePath}.value.required`, "a value the operator can compare", "missing");
                continue;
            }
            if (typeof op !== "string") {
                continue;
            }
            const membership = op === "in" || op === "not_in";
            const ordered = op === ">=" || op === "<=" || op === ">" || op === "<";
            if (membership && !Array.isArray(clause.value)) {
                this.found.hard(`${clausePath}.value.type`, `a list, for \`${op}\``, describeValue(clause.value));
            } else if (ordered && typeof clause.value !== "number") {
                this.found.hard(`${clausePath}.value.type`, `a number, for \`${op}\``, describeValue(clause.value));
            } else if (!membership && !ordered && !isScalar(clause.value)) {
                this.found.hard(
                    `${clausePath}.value.type`,
                    `a string, number or boolean, for \`${op}\``,
                    describeValue(clause.value),
                );
            }
        }
    }

    // ── markers and flags ───────────────────────────────────────────────────────────────────────

    /**
     * Facts only. "Never a verdict" is not structurally checkable, but *bounded* is: a marker is a
     * scalar or a flat record of scalars, so no derivation tree can grow under one.
     */
    private markers(value: unknown): void {
        const markers = this.record("markers", value, { required: true });
        if (markers === null) {
            return;
        }
        for (const [key, fact] of Object.entries(markers)) {
            if (isScalar(fact) || fact === null) {
                continue;
            }
            if (isRecord(fact) && Object.values(fact).every((inner) => isScalar(inner) || inner === null)) {
                continue;
            }
            this.found.hard(
                `markers.${key}.bounded`,
                "a scalar, or a flat record of them",
                describeValue(fact),
            );
        }
    }

    private flags(value: unknown): void {
        for (const [index, entry] of this.each("flags", value).entries()) {
            const path = `flags[${index}]`;
            const flag = this.record(path, entry);
            if (flag === null) {
                continue;
            }
            this.keys(path, flag, ["code", "detail", "by"]);
            this.token(path, flag, "code", { required: true });
            this.text(path, flag, "detail", { line: true });
            this.token(path, flag, "by", {});
        }
    }

    // ── module blocks ───────────────────────────────────────────────────────────────────────────

    private sessionBlock(module: "running" | "strength", block: Rec): void {
        this.keys(module, block, ["session", "petitions", "validate", "actual"]);
        this.petitions(module, block.petitions);
        this.validateBlock(module, block.validate);
        this.actual(module, block.actual);

        // The key is required and nullable: a block that produced nothing says so as `session: null`,
        // so "the domain did not deliver" and "the domain was never asked" stay different statements.
        if (block.session === undefined) {
            this.found.hard(`${module}.session.required`, "a session, or null for nothing produced", "missing");
            return;
        }
        if (block.session === null) {
            return;
        }
        const path = `${module}.session`;
        const session = this.record(path, block.session);
        if (session === null) {
            return;
        }

        const shared = ["action_id", "kind", "start", "location", "rpe", "garmin", "why", "note"];
        this.keys(
            path,
            session,
            module === "running"
                ? [...shared, "steps", "compare_to"]
                : [...shared, "movements", "rotated_off", "constraints"],
        );
        this.actionId(path, session.action_id, module, SESSION_SLOT);
        this.token(path, session, "kind", { required: true });
        this.clock(path, session, "start", { required: true, nullable: true });
        this.text(path, session, "location", { nullable: true });
        this.text(path, session, "rpe", { nullable: true });
        this.why(path, session);
        this.text(path, session, "note", { line: true });
        this.garminPush(path, session.garmin);

        if (module === "running") {
            this.runSteps(path, session.steps);
            this.compareTo(path, session.compare_to);
        } else {
            this.movements(path, session.movements);
            this.dateField(path, session, "rotated_off", { nullable: true });
            this.tokenList(`${path}.constraints`, session.constraints);
        }
    }

    private runSteps(sessionPath: string, value: unknown): void {
        const steps = this.list(`${sessionPath}.steps`, value, { required: true });
        for (const [index, entry] of steps.entries()) {
            const path = `${sessionPath}.steps[${index}]`;
            const step = this.record(path, entry);
            if (step === null) {
                continue;
            }
            this.keys(path, step, [
                "kind",
                "distance_km",
                "duration_min",
                "target",
                "incline_pct",
                "repeat",
                "why",
                "note",
            ]);
            this.token(path, step, "kind", { required: true });
            this.number(path, step, "distance_km", { nullable: true, positive: true });
            this.number(path, step, "duration_min", { nullable: true, positive: true });
            this.number(path, step, "incline_pct", { nullable: true });
            this.number(path, step, "repeat", { positive: true });
            this.why(path, step);
            this.text(path, step, "note", { line: true });

            // Warn, not hard: a targetless step has to be *representable* so the failure is
            // reportable at all. Chunk 6's `every_step_has_target` is where it blocks.
            if (step.target === undefined || step.target === null) {
                this.found.warn(
                    `${path}.target.required`,
                    "an explicit hr or pace target — warmup and cooldown included",
                    describeValue(step.target),
                );
                continue;
            }
            const target = this.record(`${path}.target`, step.target);
            if (target === null) {
                continue;
            }
            if (target.type === "hr") {
                this.keys(`${path}.target`, target, ["type", "min", "max"]);
                this.number(`${path}.target`, target, "min", { positive: true });
                this.number(`${path}.target`, target, "max", { positive: true });
            } else if (target.type === "pace") {
                this.keys(`${path}.target`, target, ["type", "min_per_km", "max_per_km"]);
                this.text(`${path}.target`, target, "min_per_km", {});
                this.text(`${path}.target`, target, "max_per_km", {});
            } else {
                this.found.hard(`${path}.target.type`, "hr | pace", describeValue(target.type));
            }
        }
    }

    private compareTo(sessionPath: string, value: unknown): void {
        if (value === undefined || value === null) {
            return;
        }
        const path = `${sessionPath}.compare_to`;
        const comparison = this.record(path, value);
        if (comparison === null) {
            return;
        }
        this.keys(path, comparison, ["date", "avg_hr", "pace_per_km", "distance_km"]);
        this.dateField(path, comparison, "date", { required: true });
        this.number(path, comparison, "avg_hr", { nullable: true, positive: true });
        this.text(path, comparison, "pace_per_km", { nullable: true });
        this.number(path, comparison, "distance_km", { nullable: true, positive: true });
    }

    private movements(sessionPath: string, value: unknown): void {
        const movements = this.list(`${sessionPath}.movements`, value, { required: true });
        for (const [index, entry] of movements.entries()) {
            const path = `${sessionPath}.movements[${index}]`;
            const movement = this.record(path, entry);
            if (movement === null) {
                continue;
            }
            this.keys(path, movement, [
                "slot",
                "exercise",
                "sets",
                "reps",
                "load",
                "distance_m",
                "per",
                "rest_s",
                "garmin",
                "why",
                "note",
            ]);
            this.token(path, movement, "slot", { required: true });
            this.text(path, movement, "exercise", { required: true });
            this.number(path, movement, "sets", { required: true, positive: true });
            this.number(path, movement, "distance_m", { nullable: true, positive: true });
            this.number(path, movement, "rest_s", { nullable: true });
            this.enumField(path, movement, "per", PER_SIDES);
            this.why(path, movement);
            this.text(path, movement, "note", { line: true });
            this.reps(path, movement.reps);
            this.load(path, movement.load);
            this.garminMovement(path, movement.garmin);
        }
    }

    private reps(movementPath: string, value: unknown): void {
        if (value === undefined || value === null) {
            return;
        }
        const shape = repsShape(value);
        if (shape === null) {
            this.found.hard(
                `${movementPath}.reps.shape`,
                "a per-set list of numbers, { min, max } or { value, per }",
                describeValue(value),
            );
            return;
        }
        if (shape === "range") {
            const range = value as RepRange;
            if (range.min > range.max) {
                this.found.hard(`${movementPath}.reps.range`, "min <= max", `${range.min} > ${range.max}`);
            }
            this.keys(`${movementPath}.reps`, value as Rec, ["min", "max"]);
        }
        if (shape === "per_side") {
            const perSide = value as Rec;
            this.keys(`${movementPath}.reps`, perSide, ["value", "per"]);
            this.enumField(`${movementPath}.reps`, perSide, "per", PER_SIDES, { required: true });
        }
    }

    private load(movementPath: string, value: unknown): void {
        const path = `${movementPath}.load`;
        if (value === undefined || value === null) {
            this.unresolvedLoad(path, value);
            return;
        }
        const load = this.record(path, value);
        if (load === null) {
            return;
        }
        this.keys(path, load, ["value", "unit", "per"]);
        this.number(path, load, "value", { required: true, nullable: true });
        this.enumField(path, load, "unit", LOAD_UNITS, { required: true });
        this.enumField(path, load, "per", PER_SIDES);

        // Bodyweight is a resolved load with no number in it; anything else with no number is not.
        if (load.value === null && load.unit !== "bodyweight") {
            this.unresolvedLoad(path, value);
        }
    }

    /** Warn, for the same reason a targetless step warns: Chunk 6 owns the blocking check. */
    private unresolvedLoad(path: string, value: unknown): void {
        this.found.warn(
            `${path}.resolved`,
            "a resolved load — a number, or `bodyweight`",
            describeValue(value),
        );
    }

    private garminPush(sessionPath: string, value: unknown): void {
        if (value === undefined || value === null) {
            return;
        }
        const path = `${sessionPath}.garmin`;
        const garmin = this.record(path, value);
        if (garmin === null) {
            return;
        }
        this.keys(path, garmin, ["push", "workout_id"]);
        if (typeof garmin.push !== "boolean") {
            this.hard(`${path}.push.type`, "boolean", garmin.push, { required: true });
        }
        if (garmin.workout_id !== undefined && garmin.workout_id !== null) {
            if (typeof garmin.workout_id !== "string" && typeof garmin.workout_id !== "number") {
                const rendered = describeValue(garmin.workout_id);
                this.found.hard(`${path}.workout_id.type`, "string, number or null", rendered);
            }
        }
    }

    private garminMovement(movementPath: string, value: unknown): void {
        if (value === undefined || value === null) {
            return;
        }
        const path = `${movementPath}.garmin`;
        const garmin = this.record(path, value);
        if (garmin === null) {
            return;
        }
        this.keys(path, garmin, ["category", "exercise_name", "status"]);
        this.upperToken(path, garmin, "category", { required: true, nullable: true });
        this.upperToken(path, garmin, "exercise_name", { required: true, nullable: true });
        this.enumField(path, garmin, "status", GARMIN_ENUM_STATUSES, { required: true });
    }

    private nutritionBlock(module: "nutrition", block: Rec): void {
        this.keys(module, block, ["tier", "meals", "totals", "petitions", "validate", "actual"]);
        this.petitions(module, block.petitions);
        this.validateBlock(module, block.validate);
        this.actual(module, block.actual);

        if (block.tier === undefined) {
            this.found.hard(`${module}.tier.required`, "a tier, or null for nothing chosen", "missing");
        } else if (block.tier !== null) {
            const path = `${module}.tier`;
            const tier = this.record(path, block.tier);
            if (tier !== null) {
                this.keys(path, tier, ["name", "kcal", "protein_g", "carb_g", "fat_g", "why"]);
                this.token(path, tier, "name", { required: true });
                for (const macro of ["kcal", "protein_g", "carb_g", "fat_g"] as const) {
                    this.number(path, tier, macro, { required: true, nullable: true });
                }
                this.why(path, tier);
            }
        }

        const meals = this.list(`${module}.meals`, block.meals, { required: true });
        for (const [index, entry] of meals.entries()) {
            const meal = isRecord(entry) && typeof entry.id === "string" ? entry.id : String(index);
            const path = `${module}.meals[${meal}]`;
            const record = this.record(path, entry);
            if (record === null) {
                continue;
            }
            this.keys(path, record, [
                "id",
                "action_id",
                "at",
                "items",
                "macros",
                "status",
                "label",
                "carries",
                "why",
                "note",
            ]);
            this.token(path, record, "id", { required: true });
            this.actionId(path, record.action_id, module, typeof record.id === "string" ? record.id : null);
            this.clock(path, record, "at", { required: true, nullable: true });
            this.enumField(path, record, "status", MEAL_STATUSES, { required: true });
            this.text(path, record, "label", { line: true });
            this.tokenList(`${path}.carries`, record.carries);
            this.why(path, record);
            this.text(path, record, "note", { line: true });
            this.macros(path, record, "macros", { required: true });

            const items = this.list(`${path}.items`, record.items, { required: true });
            for (const [itemIndex, itemEntry] of items.entries()) {
                const itemPath = `${path}.items[${itemIndex}]`;
                const item = this.record(itemPath, itemEntry);
                if (item === null) {
                    continue;
                }
                this.keys(itemPath, item, ["food", "qty", "unit", "when", "state", "note"]);
                this.text(itemPath, item, "food", { required: true });
                this.number(itemPath, item, "qty", { nullable: true });
                this.text(itemPath, item, "unit", { nullable: true });
                this.enumField(itemPath, item, "when", ["before", "with", "after"] as const);
                this.token(itemPath, item, "state", {});
                this.text(itemPath, item, "note", { line: true });
            }
        }

        if (block.totals !== undefined && block.totals !== null) {
            const path = `${module}.totals`;
            const totals = this.record(path, block.totals);
            if (totals !== null) {
                this.keys(path, totals, ["expected", "projected", "actual"]);
                for (const key of ["expected", "projected", "actual"] as const) {
                    this.macros(path, totals, key, { required: true, nullable: true });
                }
            }
        }
    }

    private macros(
        parentPath: string,
        parent: Rec,
        key: string,
        options: { required?: boolean; nullable?: boolean },
    ): void {
        const value = parent[key];
        const path = this.join(parentPath, key);
        if (value === undefined) {
            if (options.required === true) {
                this.found.hard(`${path}.required`, "a macro record, or null for not-yet", "missing");
            }
            return;
        }
        if (value === null) {
            return;
        }
        const macros = this.record(path, value);
        if (macros === null) {
            return;
        }
        this.keys(path, macros, ["kcal", "p", "c", "f"]);
        for (const macro of ["kcal", "p", "c", "f"] as const) {
            this.number(path, macros, macro, { required: true, nullable: true });
        }
    }

    // ── the fields every block shares ───────────────────────────────────────────────────────────

    private petitions(module: string, value: unknown): void {
        for (const [index, entry] of this.each(`${module}.petitions`, value).entries()) {
            const path = `${module}.petitions[${index}]`;
            const petition = this.record(path, entry);
            if (petition === null) {
                continue;
            }
            // `target` lands here, as an unknown key. A petition is addressed to the head coach and
            // to nobody else; naming an addressee is what turns it into a routed work item.
            this.keys(path, petition, ["from", "need", "why", "horizon"]);
            this.token(path, petition, "from", { required: true });
            this.text(path, petition, "need", { required: true, line: true, cap: WHY_CAP });
            this.text(path, petition, "why", { required: true, line: true, cap: WHY_CAP });
            this.enumField(path, petition, "horizon", PETITION_HORIZONS);
        }
    }

    private validateBlock(module: string, value: unknown): void {
        if (value === undefined || value === null) {
            return;
        }
        const path = `${module}.validate`;
        const block = this.record(path, value);
        if (block === null) {
            return;
        }
        // No key check: the vocabulary is the domain's (Chunks 5–6). Only "it is data" is ours.
        for (const [rule, threshold] of Object.entries(block)) {
            if (!isPlanValue(threshold)) {
                this.found.hard(`${path}.${rule}.type`, "a JSON value", describeValue(threshold));
            }
        }
    }

    /**
     * Absent and `null` both mean *nothing yet*, and are both legal. Present means a signal arrived,
     * so an empty container is refused: it would read as "we looked and there was nothing", which is
     * the collapse of `unknown` into `skipped` that §6.1 forbids.
     */
    private actual(module: string, value: unknown): void {
        if (value === undefined || value === null) {
            return;
        }
        const path = `${module}.actual`;
        const actual = this.record(path, value);
        if (actual === null) {
            return;
        }
        this.keys(path, actual, ["entries", "observed"]);

        const entries = this.each(`${path}.entries`, actual.entries);
        const observed = actual.observed !== undefined && actual.observed !== null;
        if (entries.length === 0 && !observed) {
            this.found.hard(
                `${path}.signal`,
                "at least one logged entry or an observed record — absent or null is how nothing-yet is said",
                describeValue(value),
            );
        }
        if (observed) {
            const record = this.record(`${path}.observed`, actual.observed);
            if (record !== null) {
                for (const [key, fact] of Object.entries(record)) {
                    if (!isPlanValue(fact)) {
                        this.found.hard(`${path}.observed.${key}.type`, "a JSON value", describeValue(fact));
                    }
                }
            }
        }

        for (const [index, entry] of entries.entries()) {
            const entryPath = `${path}.entries[${index}]`;
            const log = this.record(entryPath, entry);
            if (log === null) {
                continue;
            }
            this.keys(entryPath, log, ["action_id", "at", "occurred", "mode", "delta", "said"]);
            if (typeof log.action_id !== "string") {
                this.hard(`${entryPath}.action_id.required`, "the action id this entry is about", log.action_id, {
                    required: true,
                });
            } else {
                this.logTargets.push({ id: log.action_id, path: entryPath });
            }
            this.timestamp(entryPath, log, "at", { required: true });
            this.timestamp(entryPath, log, "occurred", { required: true });
            this.enumField(entryPath, log, "mode", LOG_MODES, { required: true });
            this.text(entryPath, log, "said", {});
            if (log.delta !== undefined && log.delta !== null) {
                const delta = this.record(`${entryPath}.delta`, log.delta);
                if (delta !== null) {
                    for (const [key, change] of Object.entries(delta)) {
                        if (!isPlanValue(change)) {
                            this.found.hard(`${entryPath}.delta.${key}.type`, "a JSON value", describeValue(change));
                        }
                    }
                }
            }
        }
    }

    // ── cross-cutting checks, run once the whole file is walked ──────────────────────────────────

    /** A prescribed module that produced nothing. The runner (Chunk 7.3) decides whether it blocks. */
    private deliveries(prescribed: readonly string[], root: Rec): void {
        for (const module of prescribed) {
            const block = root[module];
            const empty =
                block === undefined ||
                block === null ||
                (isRecord(block) &&
                    (module === "nutrition"
                        ? !Array.isArray(block.meals) || block.meals.length === 0
                        : block.session === undefined || block.session === null));
            if (empty) {
                this.found.warn(
                    `decision.prescribes[${module}].delivered`,
                    `a \`${module}\` block carrying what the intent asked for`,
                    describeValue(block),
                );
            }
        }
    }

    private actionId(path: string, value: unknown, module: string, slot: string | null): void {
        if (typeof value !== "string" || value.length === 0) {
            this.hard(`${path}.action_id.required`, "a stable action id, minted by core", value, {
                required: true,
            });
            return;
        }
        let derived: ActionId | null = null;
        if (this.date !== null && slot !== null && ACTION_ID_PART.test(slot)) {
            derived = makeActionId({ date: this.date, module, slot });
        }
        this.actions.push({ id: value, path, derived });
    }

    /**
     * Uniqueness blocks — two actions with one id makes every log against it ambiguous. The
     * *derived form* only warns: core mints ids through {@link makeActionId}, and freezing the
     * format hard would make today's validator reject a plan archived under an older one.
     */
    private actionIdentity(): void {
        const byId = new Map<ActionId, string[]>();
        for (const action of this.actions) {
            byId.set(action.id, [...(byId.get(action.id) ?? []), action.path]);
            if (action.derived !== null && action.derived !== action.id) {
                this.found.warn(`${action.path}.action_id.derived`, action.derived, action.id);
            }
        }
        for (const [id, paths] of byId) {
            if (paths.length > 1) {
                this.found.hard(
                    "action_id.unique",
                    "one action per id within a plan",
                    `"${id}" at ${paths.join(" and ")}`,
                );
            }
        }
        for (const target of this.logTargets) {
            if (!byId.has(target.id)) {
                this.found.warn(
                    `${target.path}.action_id.targets`,
                    "an action this plan prescribes",
                    describeValue(target.id),
                );
            }
        }
    }

    // ── primitives ──────────────────────────────────────────────────────────────────────────────

    /** A root field's path is its own key: `date`, not `.date`. */
    private join(parentPath: string, key: string): string {
        return parentPath === "" ? key : `${parentPath}.${key}`;
    }

    private hard(rule: string, expected: string, value: unknown, options: { required?: boolean }): void {
        if (value === undefined && options.required !== true) {
            return;
        }
        this.found.hard(rule, expected, describeValue(value));
    }

    private record(path: string, value: unknown, options: { required?: boolean } = {}): Rec | null {
        if (value === undefined || value === null) {
            if (options.required === true) {
                this.found.hard(`${path}.required`, "a record", describeValue(value));
            }
            return null;
        }
        if (!isRecord(value)) {
            this.found.hard(`${path}.type`, "a record", describeValue(value));
            return null;
        }
        return value;
    }

    /** An unrecognised key is hard: the CLI is the sole writer, so a stray key is an invention. */
    private keys(path: string, node: Rec, known: readonly string[]): void {
        for (const key of Object.keys(node)) {
            if (!known.includes(key)) {
                this.found.hard(`${path}.unknown_key`, `one of: ${known.join(", ")}`, key);
            }
        }
    }

    /** A list, or an empty one when the key is absent. */
    private each(path: string, value: unknown): readonly unknown[] {
        if (value === undefined || value === null) {
            return [];
        }
        return this.list(path, value, {});
    }

    private list(path: string, value: unknown, options: { required?: boolean }): readonly unknown[] {
        if (value === undefined || value === null) {
            if (options.required === true) {
                this.found.hard(`${path}.required`, "a list", describeValue(value));
            }
            return [];
        }
        if (!Array.isArray(value)) {
            this.found.hard(`${path}.type`, "a list", describeValue(value));
            return [];
        }
        return value;
    }

    private text(
        parentPath: string,
        parent: Rec,
        key: string,
        options: { required?: boolean; nullable?: boolean; line?: boolean; cap?: number },
    ): void {
        const value = parent[key];
        const path = this.join(parentPath, key);
        if (value === undefined) {
            if (options.required === true) {
                this.found.hard(`${path}.required`, "a non-empty string", "missing");
            }
            return;
        }
        if (value === null) {
            if (options.nullable !== true) {
                this.found.hard(`${path}.type`, "a non-empty string", "null");
            }
            return;
        }
        if (typeof value !== "string" || value.trim().length === 0) {
            this.found.hard(`${path}.type`, "a non-empty string", describeValue(value));
            return;
        }
        if (options.line === true || options.cap !== undefined) {
            this.oneLine(path, value, options.cap ?? WHY_CAP);
        }
    }

    /** The one-sentence cap (design §6, decision 23) — what stops the reasoning essays regrowing. */
    private why(parentPath: string, parent: Rec): void {
        const value = parent.why;
        if (value === undefined || value === null) {
            return;
        }
        if (typeof value !== "string" || value.trim().length === 0) {
            this.found.hard(`${parentPath}.why.type`, "a one-line string", describeValue(value));
            return;
        }
        this.oneLine(`${parentPath}.why`, value, WHY_CAP);
    }

    /** Warn: over-long prose is drift, not corruption, and the athlete's day still works. */
    private oneLine(path: string, value: string, cap: number): void {
        const text = value.trim();
        if (text.includes("\n") || text.length > cap) {
            this.found.warn(
                `${path}.one_line`,
                `one line, at most ${cap} characters`,
                text.includes("\n") ? `${text.split("\n").length} lines` : `${text.length} characters`,
            );
        }
    }

    private number(
        parentPath: string,
        parent: Rec,
        key: string,
        options: { required?: boolean; nullable?: boolean; positive?: boolean },
    ): void {
        const value = parent[key];
        const path = this.join(parentPath, key);
        if (value === undefined) {
            if (options.required === true) {
                this.found.hard(`${path}.required`, "a number", "missing");
            }
            return;
        }
        if (value === null) {
            if (options.nullable !== true) {
                this.found.hard(`${path}.type`, "a number", "null");
            }
            return;
        }
        if (typeof value !== "number" || !Number.isFinite(value)) {
            this.found.hard(`${path}.type`, "a number", describeValue(value));
            return;
        }
        if (options.positive === true && value <= 0) {
            this.found.hard(`${path}.positive`, "a number greater than zero", describeValue(value));
        }
    }

    private token(
        parentPath: string,
        parent: Rec,
        key: string,
        options: { required?: boolean; nullable?: boolean },
    ): void {
        this.pattern(parentPath, parent, key, TOKEN, "a lower_snake_case token", "token", options);
    }

    private upperToken(
        parentPath: string,
        parent: Rec,
        key: string,
        options: { required?: boolean; nullable?: boolean },
    ): void {
        this.pattern(parentPath, parent, key, UPPER_TOKEN, "an UPPER_SNAKE_CASE enum", "enum", options);
    }

    private clock(
        parentPath: string,
        parent: Rec,
        key: string,
        options: { required?: boolean; nullable?: boolean },
    ): void {
        this.pattern(parentPath, parent, key, CLOCK_TIME, "a 24-hour `HH:MM`", "clock", options);
    }

    private timestamp(
        parentPath: string,
        parent: Rec,
        key: string,
        options: { required?: boolean; nullable?: boolean },
    ): void {
        this.pattern(
            parentPath,
            parent,
            key,
            ISO_TIMESTAMP,
            "an ISO timestamp with a zone — a floating time cannot be compared",
            "timestamp",
            options,
        );
    }

    /** Returns the value when it is a real calendar date, so the caller can keep it. */
    private dateField(
        parentPath: string,
        parent: Rec,
        key: string,
        options: { required?: boolean; nullable?: boolean },
    ): IsoDate | null {
        const value = parent[key];
        const path = this.join(parentPath, key);
        if (!this.pattern(parentPath, parent, key, ISO_DATE, "a `YYYY-MM-DD` date", "date", options)) {
            return null;
        }
        if (typeof value !== "string") {
            return null;
        }
        const [year, month, day] = value.split("-").map(Number) as [number, number, number];
        const parsed = new Date(Date.UTC(year, month - 1, day));
        if (
            parsed.getUTCFullYear() !== year ||
            parsed.getUTCMonth() !== month - 1 ||
            parsed.getUTCDate() !== day
        ) {
            this.found.hard(`${path}.date`, "a date that exists in the calendar", describeValue(value));
            return null;
        }
        return value;
    }

    /** `true` when the value passed (including "absent and that is allowed"). */
    private pattern(
        parentPath: string,
        parent: Rec,
        key: string,
        shape: RegExp,
        expected: string,
        rule: string,
        options: { required?: boolean; nullable?: boolean },
    ): boolean {
        const value = parent[key];
        const path = this.join(parentPath, key);
        if (value === undefined) {
            if (options.required === true) {
                this.found.hard(`${path}.required`, expected, "missing");
                return false;
            }
            return true;
        }
        if (value === null) {
            if (options.nullable !== true) {
                this.found.hard(`${path}.${rule}`, expected, "null");
                return false;
            }
            return true;
        }
        if (typeof value !== "string" || !shape.test(value)) {
            this.found.hard(`${path}.${rule}`, expected, describeValue(value));
            return false;
        }
        return true;
    }

    private tokenList(path: string, value: unknown): void {
        for (const [index, entry] of this.each(path, value).entries()) {
            if (typeof entry !== "string" || !TOKEN.test(entry)) {
                this.found.hard(`${path}[${index}].token`, "a lower_snake_case token", describeValue(entry));
            }
        }
    }

    private enumField(
        parentPath: string,
        parent: Rec,
        key: string,
        allowed: readonly string[],
        options: { required?: boolean } = {},
    ): void {
        const value = parent[key];
        const path = this.join(parentPath, key);
        if (value === undefined || value === null) {
            if (options.required === true) {
                this.hard(`${path}.required`, allowed.join(" | "), value, { required: true });
            }
            return;
        }
        if (typeof value !== "string" || !allowed.includes(value)) {
            this.found.hard(`${path}.enum`, allowed.join(" | "), describeValue(value));
        }
    }
}

function isScalar(value: unknown): boolean {
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isPlanValue(value: unknown): boolean {
    if (value === null || isScalar(value)) {
        return true;
    }
    if (Array.isArray(value)) {
        return value.every(isPlanValue);
    }
    if (isRecord(value)) {
        return Object.values(value).every(isPlanValue);
    }
    return false;
}
