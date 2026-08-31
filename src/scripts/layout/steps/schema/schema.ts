import { readArtifact } from "#ir/artifact.ts";
import { blocksArtifact } from "#ir/blocks.ts";
import { toLlmJsonSchema } from "#ir/llm-contract.ts";

import { buildLayoutPayloadSchema } from "../../schemas/layout-payload.ts";
import { loadUnits } from "../../utils/load-units.ts";
import { printJson } from "../../utils/print-json.ts";
import { resolveUnit } from "../../utils/resolve-unit.ts";

export async function runSchema(projectPath: string, route: string): Promise<void> {
  const unit = resolveUnit(await loadUnits(projectPath), route);
  const { data: blocks } = await readArtifact(projectPath, blocksArtifact);

  printJson(toLlmJsonSchema(buildLayoutPayloadSchema({ route: unit.route, blocks: blocks.blocks })));
}
