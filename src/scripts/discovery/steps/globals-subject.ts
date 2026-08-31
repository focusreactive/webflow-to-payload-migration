import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { readArtifact } from "#ir/artifact.ts";
import { pagesArtifact } from "#ir/pages.ts";
import { CliUsageError } from "#lib/cli/index.ts";
import { updateStep } from "#lib/manifest/index.ts";
import { resolveSnapshotPaths } from "#lib/snapshot-store/resolve-snapshot-paths.ts";

import { DISCOVERY_GLOBALS_SUBJECT_STEP_ID } from "../constants/ids.ts";
import { GLOBALS_REPEATABILITY_THRESHOLD } from "../constants/thresholds.ts";
import { GLOBALS_RESPONSE_RELATIVE_PATH } from "../constants/paths.ts";
import { representativeRoutes } from "../utils/representative-routes.ts";
import { writeDownscaledStitch } from "../utils/write-downscaled-stitch.ts";

export async function runGlobalsSubject(projectPath: string): Promise<void> {
  const pages = (await readArtifact(projectPath, pagesArtifact)).data;
  const captured = new Set(pages.pages.map((page) => page.route));
  const source = captured.has("/") ? "/" : pages.pages.find((page) => page.kind === "static")?.route;
  if (source === undefined) {
    throw new CliUsageError("globals-subject: no captured page or static route to use as source");
  }

  const corroboration = representativeRoutes(pages)
    .filter((route) => route !== source)
    .slice(0, Math.max(0, GLOBALS_REPEATABILITY_THRESHOLD - 1));
  const { renderedHtmlPath } = await resolveSnapshotPaths(projectPath, source);
  const responsePath = join(projectPath, GLOBALS_RESPONSE_RELATIVE_PATH);
  await mkdir(dirname(responsePath), { recursive: true });

  console.log(
    JSON.stringify(
      {
        source,
        corroboration,
        stitchDownscaledPath: await writeDownscaledStitch(projectPath, source),
        renderedHtmlPath,
        responsePath,
      },
      null,
      2,
    ),
  );

  await updateStep(projectPath, DISCOVERY_GLOBALS_SUBJECT_STEP_ID, {
    status: "done",
    finishedAt: new Date().toISOString(),
  });
}
