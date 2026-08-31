import { readManifest } from "#lib/manifest/index.ts";

import { LAYOUT_STEP_ID } from "../../constants/ids.ts";
import { loadUnits } from "../../utils/load-units.ts";
import { printJson } from "../../utils/print-json.ts";

export async function runState(projectPath: string): Promise<void> {
  const units = await loadUnits(projectPath);
  const manifest = await readManifest(projectPath);
  const statusOf = (stepId: string): string => manifest.steps[stepId]?.status ?? "pending";

  printJson({
    phase: LAYOUT_STEP_ID,
    steps: [
      ...units.map((unit) => ({
        id: unit.stepId,
        status: statusOf(unit.stepId),
        route: unit.route,
        routeKey: unit.routeKey,
      })),
      { id: LAYOUT_STEP_ID, status: statusOf(LAYOUT_STEP_ID) },
    ],
  });
}
