import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { responsePath } from "../constants/paths.ts";
import type { SynthVertical } from "../types.ts";
import { printJson } from "../utils/print-json.ts";

export async function runContentSubject(
  projectPath: string,
  vertical: SynthVertical,
  entityKey: string,
): Promise<void> {
  const path = responsePath(projectPath, vertical.id, entityKey, "content");
  await mkdir(dirname(path), { recursive: true });
  printJson(await vertical.contentSubject(projectPath, entityKey));
}
