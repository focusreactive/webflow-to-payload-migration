import { readFile } from "node:fs/promises";

import { stitchIndexSchema, type StitchIndexData } from "#ir/stitch.ts";

import { stitchIndexPath } from "./paths.ts";

export async function readStitchIndex(projectPath: string, route: string): Promise<StitchIndexData> {
  const raw: unknown = JSON.parse(await readFile(stitchIndexPath(projectPath, route), "utf8"));

  return stitchIndexSchema.parse(raw).data;
}
