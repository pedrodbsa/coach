/**
 * The console adapter. The engine writes only through these sinks, never `process.stdout`/`stderr`
 * directly, so tests capture output by injecting buffers.
 */

/** A write-only text sink; the CLI's stdout/stderr or a test buffer. */
export interface OutputSink {
    write(chunk: string): void;
}

/**
 * The two machine channels. `stdout` is **framework-reserved** — the execution layer emits exactly
 * one envelope there and commands never write to it (structured JSON on stdout is a hard
 * invariant). Commands use `stderr` for diagnostics only.
 */
export interface IoSinks {
    stdout: OutputSink;
    stderr: OutputSink;
}
