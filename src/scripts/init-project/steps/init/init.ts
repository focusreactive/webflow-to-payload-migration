import { toolRootDir } from "#lib/migrate-config/index.ts";
import { runConfigSchema } from "#run-config/schema.ts";

import { readToolVersion } from "./utils/read-tool-version.ts";
import { readRunConfigFile } from "./utils/read-run-config.ts";
import { initProject } from "./init-project.ts";

export interface InitResult {
  projectPath: string;
  created: boolean;
}

export async function runInit(runConfigPath: string): Promise<void> {
  const runConfig = runConfigSchema.parse(readRunConfigFile(runConfigPath));
  const rootDir = toolRootDir();

  const result = await initProject(runConfig, {
    toolRootDir: rootDir,
    toolVersion: readToolVersion(rootDir),
  });

  console.log(JSON.stringify(result, null, 2));
}
