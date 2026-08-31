import { join } from "node:path";

import { synthEntryDir, type Vertical } from "#lib/synth-store/paths.ts";

export const SURFACE_RECORD_FILE = "record.json";

export function recordPath(projectPath: string, vertical: Vertical, entityKey: string): string {
  return join(synthEntryDir(projectPath, vertical, entityKey), SURFACE_RECORD_FILE);
}
