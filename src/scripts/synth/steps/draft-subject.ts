import { readArtifact } from "#ir/artifact.ts";
import { designTokensArtifact } from "#tokens/schemas/design-tokens.ts";

import { componentPath, contentShardPath, inputPath, schemaShardPath } from "../constants/paths.ts";
import type { EntityAddress, SynthVertical } from "../types.ts";
import { printJson } from "../utils/print-json.ts";

import { tokenVocabulary } from "./utils/token-vocabulary.ts";

export async function runDraftSubject(
  projectPath: string,
  vertical: SynthVertical,
  address: EntityAddress,
): Promise<void> {
  const entityKey = vertical.surfaceKey(address);
  const tokens = (await readArtifact(projectPath, designTokensArtifact)).data;

  printJson({
    entity: entityKey,
    vertical: vertical.id,
    exemplar: await vertical.exemplar(projectPath, address),
    fields: await vertical.surfaceFields(projectPath, address),
    schemaPath: schemaShardPath(projectPath, vertical.id, entityKey),
    contentPath: contentShardPath(projectPath, vertical.id, address.key),
    inputPath: inputPath(projectPath, vertical.id, entityKey),
    componentPath: componentPath(projectPath, vertical.id, entityKey),
    tokens: tokenVocabulary(tokens),
  });
}
