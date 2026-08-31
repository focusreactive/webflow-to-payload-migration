import { CliUsageError } from "#lib/cli/index.ts";
import { readManifest, withStep } from "#lib/manifest/index.ts";

import { LAYOUT_STEP_ID } from "../../constants/ids.ts";
import { loadUnits } from "../../utils/load-units.ts";

export async function runFinalize(projectPath: string, force: boolean): Promise<void> {
  const unitStepIds = (await loadUnits(projectPath)).map((unit) => unit.stepId);

  const computed = await withStep(
    projectPath,
    LAYOUT_STEP_ID,
    async () => {
      const manifest = await readManifest(projectPath);
      const pending = unitStepIds.filter((stepId) => manifest.steps[stepId]?.status !== "done");
      if (pending.length > 0) {
        throw new CliUsageError(`layout finalize: pending units: ${pending.join(", ")}`);
      }
      return unitStepIds.length;
    },
    { force },
  );

  console.log(
    JSON.stringify({
      step: LAYOUT_STEP_ID,
      status: computed !== undefined ? "done" : "skipped",
      units: computed ?? "unchanged",
    }),
  );
}
