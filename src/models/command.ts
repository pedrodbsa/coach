import type { CoachContext } from "../context.ts";
import type { Envelope } from "./envelope.ts";

/**
 * Framework-independent contract for every coach command: a function of a profile-scoped
 * {@link CoachContext} and its parsed `Input`, returning an {@link Envelope}. Adapters translate
 * transport arguments into `Input`, build the context, and publish the envelope. Commands never
 * import their adapters and never touch stdout — the execution layer owns emission.
 */
export type CoachCommand<Input, Output> = (ctx: CoachContext, input: Input) => Envelope<Output> | Promise<Envelope<Output>>;
