/**
 * Effective policy = shipped defaults ⊕ per-profile overrides, resolved once, here.
 *
 * **Objects merge recursively; arrays and scalars replace wholesale.** An override list — the
 * athlete's HR zones, their gym's equipment — is a *replacement*, not an addition: appending
 * would silently keep a default the athlete meant to remove. An explicit `null` in the override
 * is a value, so it replaces too.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep-copies so neither layer is aliased into the result — `layers()` must stay truthful. */
function clone<T>(value: T): T {
    return structuredClone(value);
}

export function mergeLayers(defaults: unknown, overrides: unknown): unknown {
    if (!isPlainObject(defaults) || !isPlainObject(overrides)) {
        return clone(overrides);
    }

    const merged: Record<string, unknown> = clone(defaults);
    for (const [key, override] of Object.entries(overrides)) {
        merged[key] = key in merged ? mergeLayers(merged[key], override) : clone(override);
    }
    return merged;
}
