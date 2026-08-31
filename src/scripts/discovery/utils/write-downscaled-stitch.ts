import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { routeDir } from "#lib/route-dir.ts";
import { stitchPngPath } from "#lib/stitch/paths.ts";

import { DOWNSCALE_LONG_SIDE } from "../constants/evidence.ts";
import { EVIDENCE_RELATIVE_DIR } from "../constants/paths.ts";

import { downscalePng } from "./downscale-png.ts";

export async function writeDownscaledStitch(projectPath: string, route: string): Promise<string> {
  const src = await readFile(stitchPngPath(projectPath, route, "desktop"));
  const out = join(projectPath, EVIDENCE_RELATIVE_DIR, `${routeDir(route)}.desktop.png`);

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, downscalePng(src, DOWNSCALE_LONG_SIDE));

  return out;
}
