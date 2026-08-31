import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { responsePath } from "../constants/paths.ts";
import type { EntityAddress, SynthVertical } from "../types.ts";
import { printJson } from "../utils/print-json.ts";

export async function runFieldsSubject(
  projectPath: string,
  vertical: SynthVertical,
  address: EntityAddress,
): Promise<void> {
  const path = responsePath(projectPath, vertical.id, vertical.surfaceKey(address), "fields");
  await mkdir(dirname(path), { recursive: true });
  printJson(await vertical.fieldsSubject(projectPath, address));
}
