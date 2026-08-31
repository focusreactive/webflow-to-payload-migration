import { artifactPath, readArtifact, writeNdjsonArtifact } from "#ir/artifact.ts";
import { blocksArtifact } from "#ir/blocks.ts";
import { layoutRouteArtifactFor, layoutUnitMetaSchema } from "#ir/layout.ts";
import { recordArtifact, updateStep } from "#lib/manifest/index.ts";
import { readStitchIndex } from "#lib/stitch/index.ts";

import { responseRelativePath } from "../../constants/paths.ts";
import { loadUnits } from "../../utils/load-units.ts";
import { readResponse } from "../../utils/read-response.ts";
import { reportAcceptErrors } from "../../utils/report-accept-errors.ts";
import { resolveUnit } from "../../utils/resolve-unit.ts";

import { ingestLayoutPayload } from "./ingest-layout-payload.ts";
import { readKnownAssetIds } from "./utils/accept.ts";

export async function runAccept(projectPath: string, route: string): Promise<void> {
  const unit = resolveUnit(await loadUnits(projectPath), route);
  const response = await readResponse(projectPath, responseRelativePath(unit.routeKey));

  const stitchIndex = await readStitchIndex(projectPath, unit.route);
  const { data: blocks } = await readArtifact(projectPath, blocksArtifact);
  const knownAssetIds = await readKnownAssetIds(projectPath);

  const outcome = ingestLayoutPayload({
    route: unit.route,
    response,
    blocks: blocks.blocks,
    knownMigIds: new Set(Object.keys(stitchIndex.elements)),
    ...(knownAssetIds !== undefined ? { knownAssetIds } : {}),
  });
  if (!outcome.ok) {
    reportAcceptErrors(outcome.errors);
    return;
  }

  const def = layoutRouteArtifactFor(unit.routeKey);
  const meta = layoutUnitMetaSchema.parse({ unitKind: "static", route: unit.route });
  await writeNdjsonArtifact(projectPath, def, { provenance: "ai", items: outcome.records, extraMeta: meta });
  await recordArtifact(projectPath, unit.stepId, def.kind, artifactPath(projectPath, def));
  await updateStep(projectPath, unit.stepId, { status: "done", finishedAt: new Date().toISOString() });

  console.log(
    JSON.stringify({
      ok: true,
      step: unit.stepId,
      artifact: artifactPath(projectPath, def),
      records: outcome.records.length,
    }),
  );
}
