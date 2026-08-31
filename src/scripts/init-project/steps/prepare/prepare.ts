import { loadMigrateConfig, toolRootDir } from "#lib/migrate-config/index.ts";

import { buildRunConfig, type BuildRunConfigInput } from "./build-run-config.ts";
import { resolveProject } from "./resolve-project.ts";

export async function runPrepare(input: BuildRunConfigInput): Promise<void> {
  const runConfig = buildRunConfig(input, loadMigrateConfig());
  const resolved = await resolveProject(runConfig, { toolRootDir: toolRootDir() });

  console.log(JSON.stringify({ runConfig, ...resolved }, null, 2));
}
