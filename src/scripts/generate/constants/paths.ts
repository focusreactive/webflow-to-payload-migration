import { join } from "node:path";

import { type GlobalName } from "#ir/globals.ts";

export const GLOBAL_COMPONENT_DIR_PREFIX = "global-";
export const DELIVERABLE_FILES_ARTIFACT_PATH = join(".migration", "artifacts", "generate-files.json");
export const PAGE_TREE_ARTIFACT_PATH = join(".migration", "artifacts", "generate", "page-tree.json");
export const LINT_FINDINGS_ARTIFACT_PATH = join(".migration", "artifacts", "generate", "lint.txt");

export function globalComponentDir(name: GlobalName): string {
  return `${GLOBAL_COMPONENT_DIR_PREFIX}${name}`;
}
