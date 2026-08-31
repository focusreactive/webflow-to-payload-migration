import { join } from "node:path";

import { readArtifact } from "#ir/artifact.ts";
import { blocksArtifact } from "#ir/blocks.ts";
import { resolveSnapshotPaths } from "#lib/snapshot-store/resolve-snapshot-paths.ts";
import { readStitchIndex } from "#lib/stitch/index.ts";
import { stitchPngPath } from "#lib/stitch/paths.ts";

import { responseRelativePath } from "../../constants/paths.ts";
import type { LayoutStaticUnit, LayoutUnitSubject } from "../../types.ts";

import { readChrome } from "./utils/assemble-unit-subject.ts";

export async function assembleUnitSubject(projectPath: string, unit: LayoutStaticUnit): Promise<LayoutUnitSubject> {
  const stitchIndex = await readStitchIndex(projectPath, unit.route);
  const { renderedHtmlPath, stylesPath } = await resolveSnapshotPaths(projectPath, unit.route);
  const { data: blocks } = await readArtifact(projectPath, blocksArtifact);

  return {
    unit,
    stitches: Object.keys(stitchIndex.stitches).map((viewport) => ({
      viewport,
      file: stitchPngPath(projectPath, unit.route, viewport),
    })),
    renderedHtmlPath,
    stylesPath,
    vocabulary: blocks.blocks,
    chrome: await readChrome(projectPath),
    responsePath: join(projectPath, responseRelativePath(unit.routeKey)),
  };
}
