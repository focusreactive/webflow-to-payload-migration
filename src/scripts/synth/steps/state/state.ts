import { existsSync } from "node:fs";
import { join } from "node:path";

import { readManifest } from "#lib/manifest/index.ts";

import { CONTENT_SHARD_FILE, SCHEMA_SHARD_FILE } from "../../constants/paths.ts";
import { SYNTH_STEP_IDS } from "../../constants/ids.ts";
import type { SynthVertical } from "../../types.ts";
import { printJson } from "../../utils/print-json.ts";

import { surfaceProgress, type SurfaceProgress } from "./surface-progress.ts";

interface EntityState {
  key: string;
  fields: boolean;
  content: boolean;
  surfaces: SurfaceProgress[];
}

export async function runState(projectPath: string, vertical: SynthVertical): Promise<void> {
  const manifest = await readManifest(projectPath);
  const entities: EntityState[] = [];

  for (const entity of await vertical.roster(projectPath)) {
    const entityDir = vertical.surfaceDir(projectPath, { key: entity.key });
    const addresses =
      vertical.sectioned ?
        entity.sections.map((section) => ({ key: entity.key, section }))
      : [{ key: entity.key }];

    entities.push({
      key: entity.key,
      fields: existsSync(join(entityDir, SCHEMA_SHARD_FILE)),
      content: existsSync(join(entityDir, CONTENT_SHARD_FILE)),
      surfaces: await Promise.all(addresses.map((address) => surfaceProgress(projectPath, vertical, address))),
    });
  }

  printJson({
    phase: "synth",
    vertical: vertical.id,
    steps: SYNTH_STEP_IDS.map((id) => ({ id, status: manifest.steps[id]?.status ?? "pending" })),
    entities,
  });
}
