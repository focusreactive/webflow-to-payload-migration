import { readManifest, withStep } from "#lib/manifest/index.ts";

import { GENERATE_SCAFFOLD_STEP_ID } from "../../constants/ids.ts";

import { emitDeliverable } from "./emit-deliverable.ts";

export async function runScaffold(opts: { projectPath: string; force: boolean }): Promise<void> {
  const manifest = await readManifest(opts.projectPath);
  const wasSkipped = manifest.steps[GENERATE_SCAFFOLD_STEP_ID]?.status === "done" && !opts.force;

  const result = await withStep(
    opts.projectPath,
    GENERATE_SCAFFOLD_STEP_ID,
    () => emitDeliverable({ projectPath: opts.projectPath }),
    { force: opts.force },
  );

  if (wasSkipped || result === undefined) {
    console.log(JSON.stringify({ step: GENERATE_SCAFFOLD_STEP_ID, status: "skipped" }));
    return;
  }

  console.log(
    JSON.stringify({
      step: GENERATE_SCAFFOLD_STEP_ID,
      status: "done",
      files: result.files.length,
      warnings: result.warnings,
    }),
  );
}
