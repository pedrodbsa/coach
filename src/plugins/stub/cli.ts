import type { CliBinding } from "../../cli/binding.ts";
import type { StubPlugin } from "./index.ts";

/**
 * Which method each verb calls. Compile-checked against {@link StubPlugin}: rename a method and this
 * file stops compiling, which is what keeps the two halves of one plugin in step.
 *
 * Neither verb takes input yet — task 3.0 teaches the binding to declare flags and positionals, and
 * `narrow` is where they will become a method's typed input.
 */
export const stubCli = {
    summary: { method: "summary", narrow: () => undefined },
    inspect: { method: "inspect", narrow: () => undefined },
} as const satisfies CliBinding<StubPlugin>;
