import { readManifest } from "#lib/manifest/index.ts";

import { ASSETS_STEP_IDS, ASSETS_STEP_PREFIX } from "../constants/ids.ts";

export async function runState(projectPath: string): Promise<void> {
  const manifest = await readManifest(projectPath);
  const steps = ASSETS_STEP_IDS.map((id) => ({ id, status: manifest.steps[id]?.status ?? "pending" }));

  console.log(JSON.stringify({ phase: ASSETS_STEP_PREFIX, steps }, null, 2));
}
