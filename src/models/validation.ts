/**
 * The validator return shape, fixed once (plan Global Constraints) and reused unchanged by every
 * validator the engine grows: the plan schema here in Chunk 3, then the nutrition ladder (Chunk 5),
 * the running/strength checks (Chunk 6) and `coach head validate` (Chunk 7).
 *
 * It lives beside the envelope rather than inside `plan.ts` because a domain validator needs the
 * shape without needing the plan types — and because `ok` being *derived* from the severities is the
 * one rule all of them must share. A validator that chose its own `ok` could pass a hard violation
 * through, which is exactly the failure the severity split exists to prevent.
 *
 * This is deliberately **not** the envelope's `Gap`. A gap says *"I could not see this"* and reaches
 * the athlete as something to do; a violation says *"this document breaks a rule"* and reaches the
 * workflow runner, which re-runs the step, escalates the model, or opens a `needs-input` gate. The
 * two travel different paths, so they stay different shapes.
 */

/** `hard` blocks — the document is not persisted. `warn` annotates and travels with it. */
export type Severity = "hard" | "warn";

export interface Violation {
    /**
     * The rule that was broken, as `<path-in-the-document>.<rule>` — `strength.session.movements[0]
     * .load.resolved`. The fixed four fields have no room for a separate path, and a rule name with
     * no location in it cannot be acted on: two movements break the same rule for different reasons.
     */
    readonly rule: string;
    readonly expected: string;
    readonly actual: string;
    readonly severity: Severity;
}

/**
 * Either the narrowed value or nothing, with the violations either way — a `warn` rides along on a
 * successful validation rather than being dropped.
 */
export type ValidationResult<T> =
    | { readonly ok: true; readonly value: T; readonly violations: readonly Violation[] }
    | { readonly ok: false; readonly value: null; readonly violations: readonly Violation[] };

/**
 * Collects violations during a walk over an untrusted document, then resolves to the result.
 *
 * A validator returns *every* violation it found, not the first: a specialist re-running against one
 * complaint at a time costs an agent call per fix, and the workflow runner's re-run ladder gets one
 * shot before it escalates.
 */
export class Violations {
    private readonly found: Violation[] = [];

    /** Blocks. Nothing downstream may see the document. */
    hard(rule: string, expected: string, actual: string): void {
        this.found.push({ rule, expected, actual, severity: "hard" });
    }

    /** Annotates. The document is still usable and the note travels with it. */
    warn(rule: string, expected: string, actual: string): void {
        this.found.push({ rule, expected, actual, severity: "warn" });
    }

    get violations(): readonly Violation[] {
        return this.found;
    }

    /** `ok` is derived here and nowhere else: true iff nothing hard was found. */
    resolve<T>(value: T): ValidationResult<T> {
        const blocked = this.found.some((violation) => violation.severity === "hard");
        return blocked
            ? { ok: false, value: null, violations: this.found }
            : { ok: true, value, violations: this.found };
    }
}

const RENDER_CAP = 60;

/**
 * Renders an offending value for a violation's `actual`, **type first** — "expected string, actual
 * number 0.2" is the whole story of the prototype's unquoted `schema_version`, and the type is the
 * part a reader needs. Truncated, because `actual` is a report line, not a copy of the document.
 */
export function describeValue(value: unknown): string {
    if (value === undefined) {
        return "missing";
    }
    if (value === null) {
        return "null";
    }
    if (Array.isArray(value)) {
        return `list of ${value.length}`;
    }
    switch (typeof value) {
        case "string": {
            const text = value.length > RENDER_CAP ? `${value.slice(0, RENDER_CAP)}…` : value;
            return `string ${JSON.stringify(text)}`;
        }
        case "number":
        case "boolean":
            return `${typeof value} ${String(value)}`;
        case "object":
            return `record { ${Object.keys(value).join(", ")} }`;
        default:
            return typeof value;
    }
}
