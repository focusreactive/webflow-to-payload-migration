import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { readArtifact } from "#ir/artifact.ts";
import { designTokensArtifact } from "#tokens/schemas/design-tokens.ts";

import { componentPath, contentShardPath, inputPath, schemaShardPath } from "../constants/paths.ts";
import type { EntityAddress, SynthVertical } from "../types.ts";
import { componentGuardrailWarnings, type DeclaredField } from "../utils/component-guardrails.ts";
import { printJson } from "../utils/print-json.ts";

import { tokenVocabulary } from "./utils/token-vocabulary.ts";

async function componentWarnings(path: string, fields: readonly DeclaredField[]): Promise<string[]> {
  if (!existsSync(path)) return [];
  return componentGuardrailWarnings(await readFile(path, "utf8"), fields);
}

export async function runDraftSubject(
  projectPath: string,
  vertical: SynthVertical,
  address: EntityAddress,
): Promise<void> {
  const entityKey = vertical.surfaceKey(address);
  const tokens = (await readArtifact(projectPath, designTokensArtifact)).data;
  const fields = await vertical.surfaceFields(projectPath, address);
  const componentFile = componentPath(projectPath, vertical.id, entityKey);

  printJson({
    entity: entityKey,
    vertical: vertical.id,
    exemplar: await vertical.exemplar(projectPath, address),
    fields,
    schemaPath: schemaShardPath(projectPath, vertical.id, entityKey),
    contentPath: contentShardPath(projectPath, vertical.id, address.key),
    inputPath: inputPath(projectPath, vertical.id, entityKey),
    componentPath: componentFile,
    componentWarnings: await componentWarnings(componentFile, fields),
    tokens: tokenVocabulary(tokens),
  });
}
