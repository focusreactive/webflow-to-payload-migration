import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { readShardJson } from "#lib/synth-store/paths.ts";

import { inputPath, responsePath } from "../constants/paths.ts";
import type { EntityAddress, SynthVertical } from "../types.ts";
import { printJson } from "../utils/print-json.ts";
import { planRichText } from "../utils/richtext/index.ts";

export async function runRichTextSubject(
  projectPath: string,
  vertical: SynthVertical,
  address: EntityAddress,
): Promise<void> {
  const entityKey = vertical.surfaceKey(address);
  const path = responsePath(projectPath, vertical.id, entityKey, "richtext");
  await mkdir(dirname(path), { recursive: true });

  const literals = await readShardJson<Record<string, unknown>>(inputPath(projectPath, vertical.id, entityKey));
  printJson({
    entity: entityKey,
    fields: planRichText({ fields: await vertical.surfaceFields(projectPath, address), literals }),
    responsePath: path,
  });
}
