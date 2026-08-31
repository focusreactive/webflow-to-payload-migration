import { join } from "node:path";

import { GLOBAL_NAMES, type GlobalName } from "#ir/globals.ts";
import { type BlocksData } from "#ir/blocks.ts";

export const GLOBAL_COMPONENT_DIR_PREFIX = "global-";
export const DELIVERABLE_FILES_ARTIFACT_PATH = join(".migration", "artifacts", "generate-files.json");
export const PAGE_TREE_ARTIFACT_PATH = join(".migration", "artifacts", "generate", "page-tree.json");
export const LINT_FINDINGS_ARTIFACT_PATH = join(".migration", "artifacts", "generate", "lint.txt");

export function globalComponentDir(name: GlobalName): string {
  return `${GLOBAL_COMPONENT_DIR_PREFIX}${name}`;
}

export function assertNoGlobalDirCollision(blocks: BlocksData): void {
  const reserved = new Set(GLOBAL_NAMES.map((name) => globalComponentDir(name)));

  for (const block of blocks.blocks) {
    if (reserved.has(String(block.id))) {
      throw new Error(
        `BlockTypeId "${String(block.id)}" collides with the reserved chrome dir; `
          + `re-run blocks synthesis with a different role name (--force blocks)`,
      );
    }
  }
}
