import { join } from "node:path";

import { STITCH_INDEX_SCHEMA_VERSION, stitchIndexSchema, type StitchIndexData } from "#ir/stitch.ts";
import { writeFileAtomic } from "#lib/fs.ts";
import type { Logger } from "#lib/logger.ts";
import { stitchPngFile, stitchRouteDirPath } from "#lib/stitch/paths.ts";

import type { RenderedPage } from "./types.ts";

export async function writeRouteStitch(opts: {
  projectPath: string;
  route: string;
  url: string;
  rendered: RenderedPage;
  largePngWarnBytes: number;
  logger: Logger;
}): Promise<void> {
  const { projectPath, route, url, rendered, largePngWarnBytes, logger } = opts;
  const routeDirPath = stitchRouteDirPath(projectPath, route);

  const stitches: StitchIndexData["stitches"] = {};
  for (const [viewportName, capture] of Object.entries(rendered.stitches)) {
    const file = stitchPngFile(viewportName);
    await writeFileAtomic(join(routeDirPath, file), capture.buffer);
    if (capture.buffer.length > largePngWarnBytes) {
      logger.warn("snapshot: large stitch PNG", { route, viewport: viewportName, bytes: capture.buffer.length });
    }
    stitches[viewportName] = {
      file,
      doc: capture.doc,
      dpr: capture.dpr,
      pixels: capture.pixels,
      stickyRegions: capture.stickyRegions,
    };
  }

  const elements: StitchIndexData["elements"] = {};
  for (const [migId, entry] of Object.entries(rendered.styles)) {
    for (const [viewportName, rect] of Object.entries(entry.rects)) {
      if (rect.width <= 0 || rect.height <= 0) continue;
      (elements[migId] ??= {})[viewportName] = { rect };
    }
  }

  const data: StitchIndexData = { route, url, capturedAt: new Date().toISOString(), stitches, elements };
  const validated = stitchIndexSchema.parse({
    schemaVersion: STITCH_INDEX_SCHEMA_VERSION,
    provenance: "published",
    data,
  });
  await writeFileAtomic(join(routeDirPath, "index.json"), `${JSON.stringify(validated, null, 2)}\n`);
}
