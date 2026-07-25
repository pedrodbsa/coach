import type { CoachCommand } from "../models/command.ts";
import { makeEnvelope, SCHEMA_VERSION } from "../models/envelope.ts";

const CLI_VERSION = "0.1.0";

export interface CoreVersionOutput {
    version: string;
    schema_version: string;
}

/**
 * Returns engine version information. Runs inside an already profile-scoped {@link CoachContext},
 * so there is nothing to re-validate — and it reads no files, clock, or DB. Takes no verb options;
 * its profile scope lives on the context.
 */
export const coreVersion: CoachCommand<unknown, CoreVersionOutput> = () =>
    makeEnvelope({
        version: CLI_VERSION,
        schema_version: SCHEMA_VERSION,
    });
