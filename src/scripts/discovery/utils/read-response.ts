import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { CliUsageError } from "#lib/cli/index.ts";

export async function readResponse(projectPath: string, relativePath: string): Promise<unknown> {
  const path = join(projectPath, relativePath);
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CliUsageError(`discovery accept: cannot read the response at ${path}\n${reason}`);
  }
}
