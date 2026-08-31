import type { AcceptError } from "../types.ts";

export function reportAcceptErrors(errors: AcceptError[]): void {
  console.log(JSON.stringify({ ok: false, errors }, null, 2));
  process.exitCode = 1;
}
