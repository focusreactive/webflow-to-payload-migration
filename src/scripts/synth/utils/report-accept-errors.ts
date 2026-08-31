import type { AcceptError } from "../types.ts";

export function reportAcceptErrors(errors: AcceptError[]): void {
  process.stdout.write(`${JSON.stringify({ ok: false, errors }, null, 2)}\n`);
  process.exitCode = 1;
}
