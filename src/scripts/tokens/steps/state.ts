import { readManifest } from "#lib/manifest/index.ts";

import { TOKENS_STEP_IDS } from "../constants/ids.ts";

export async function runState(projectPath: string): Promise<void> {
  const manifest = await readManifest(projectPath);
  const steps = TOKENS_STEP_IDS.map((id) => ({ id, status: manifest.steps[id]?.status ?? "pending" }));

  console.log(JSON.stringify({ phase: "tokens", steps }, null, 2));
}
