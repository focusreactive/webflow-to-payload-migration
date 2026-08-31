import { readManifest } from "#lib/manifest/index.ts";

import { DISCOVERY_STEP_IDS, DISCOVERY_STEP_PREFIX } from "../constants/ids.ts";

export async function runState(projectPath: string): Promise<void> {
  const manifest = await readManifest(projectPath);
  const steps = DISCOVERY_STEP_IDS.map((id) => ({ id, status: manifest.steps[id]?.status ?? "pending" }));

  console.log(JSON.stringify({ phase: DISCOVERY_STEP_PREFIX, steps }, null, 2));
}
