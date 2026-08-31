import { withStep } from "#lib/manifest/index.ts";

import type { SynthVertical } from "../types.ts";
import { printJson } from "../utils/print-json.ts";

export async function runFinalize(projectPath: string, vertical: SynthVertical, force: boolean): Promise<void> {
  const computed = await withStep(projectPath, vertical.stepId, () => vertical.fold(projectPath), { force });
  printJson({
    step: vertical.stepId,
    status: computed !== undefined ? "done" : "skipped",
    entities: computed?.count ?? "unchanged",
  });
}
