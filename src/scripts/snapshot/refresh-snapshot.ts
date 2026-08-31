import { rm } from "node:fs/promises";
import { join } from "node:path";

import { INVENTORY_STEP_ID } from "#inventory/constants/ids.ts";
import { clearStepsByPrefix, updateStep } from "#lib/manifest/index.ts";
import { openSnapshotStore, readOnlyClient } from "#lib/snapshot-store/index.ts";
import { STITCH_DIR } from "#lib/stitch/paths.ts";
import { loadRunConfig } from "#run-config/load.ts";

import { SNAPSHOT_STEP_ID } from "./constants/ids.ts";
import { REFRESH_CLEARED_STEP_PREFIXES } from "./constants/refresh.ts";

export async function runRefreshSnapshot(projectPath: string): Promise<void> {
  await loadRunConfig(projectPath);

  const store = await openSnapshotStore(projectPath, readOnlyClient());
  await store.clearExceptProbe();
  await rm(join(projectPath, STITCH_DIR), { recursive: true, force: true });

  for (const prefix of REFRESH_CLEARED_STEP_PREFIXES) {
    await clearStepsByPrefix(projectPath, prefix);
  }

  const resetPatch = {
    status: "pending" as const,
    startedAt: undefined,
    finishedAt: undefined,
    error: undefined,
  };
  await updateStep(projectPath, INVENTORY_STEP_ID, resetPatch);
  await updateStep(projectPath, SNAPSHOT_STEP_ID, resetPatch);

  console.log(JSON.stringify({ step: SNAPSHOT_STEP_ID, status: "refreshed" }));
}
