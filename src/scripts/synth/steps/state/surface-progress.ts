import { existsSync } from "node:fs";
import { join } from "node:path";

import { readSurfaceRecord, type SurfacePhase } from "#lib/surface-record/index.ts";

import { componentPath, inputPath, RICHTEXT_DIR, SCHEMA_SHARD_FILE } from "../../constants/paths.ts";
import type { EntityAddress, SynthVertical } from "../../types.ts";

export interface SurfaceProgress {
  surface: string;
  fields: boolean;
  input: boolean;
  richtext: boolean;
  component: boolean;
  phase: SurfacePhase;
}

export async function surfaceProgress(
  projectPath: string,
  vertical: SynthVertical,
  address: EntityAddress,
): Promise<SurfaceProgress> {
  const surface = vertical.surfaceKey(address);
  const dir = vertical.surfaceDir(projectPath, address);
  const record = await readSurfaceRecord(projectPath, vertical.id, surface);

  const fields = existsSync(join(dir, SCHEMA_SHARD_FILE));
  const input = existsSync(inputPath(projectPath, vertical.id, surface));
  const richtext = existsSync(join(dir, RICHTEXT_DIR));
  const component = existsSync(componentPath(projectPath, vertical.id, surface));

  const derived: SurfacePhase =
    !fields ? "fields"
    : !input ? "input"
    : !richtext ? "richtext"
    : "author";

  return { surface, fields, input, richtext, component, phase: record?.phase ?? derived };
}
