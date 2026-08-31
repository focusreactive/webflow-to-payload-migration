import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { CliUsageError } from "#lib/cli/index.ts";

export async function readResponse(path: string): Promise<unknown> {
  if (!existsSync(path)) {
    throw new CliUsageError(`no response at ${path} — run the subject step and write the answer to the path it prints`);
  }
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CliUsageError(`the response at ${path} is not valid JSON\n${reason}`);
  }
}
