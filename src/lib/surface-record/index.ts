import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { writeFileAtomic } from "#lib/fs.ts";
import type { Vertical } from "#lib/synth-store/paths.ts";

import { recordPath } from "./paths.ts";
import { surfaceRecordSchema, type SurfaceRecord } from "./schema.ts";

export { surfaceRecordSchema, type SurfaceCheck, type SurfacePhase, type SurfaceRecord } from "./schema.ts";

export async function readSurfaceRecord(
  projectPath: string,
  vertical: Vertical,
  entityKey: string,
): Promise<SurfaceRecord | undefined> {
  const path = recordPath(projectPath, vertical, entityKey);
  if (!existsSync(path)) return undefined;
  return surfaceRecordSchema.parse(JSON.parse(await readFile(path, "utf8")));
}

export async function writeSurfaceRecord(
  projectPath: string,
  vertical: Vertical,
  entityKey: string,
  record: SurfaceRecord,
): Promise<void> {
  const path = recordPath(projectPath, vertical, entityKey);
  await writeFileAtomic(path, `${JSON.stringify(surfaceRecordSchema.parse(record), null, 2)}\n`);
}
