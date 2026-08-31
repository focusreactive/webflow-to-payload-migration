import { join } from "node:path";

const STEP_DIR = join(".migration", "steps", "discovery");

export const EVIDENCE_RELATIVE_DIR = join(".migration", "artifacts", "discovery", "_evidence");

export const GLOBALS_RESPONSE_RELATIVE_PATH = join(STEP_DIR, "globals", "response.json");
export const DEDUP_RESPONSE_RELATIVE_PATH = join(STEP_DIR, "dedup", "response.json");

export function blocksResponseRelativePath(routeKey: string): string {
  return join(STEP_DIR, "blocks", routeKey, "response.json");
}
