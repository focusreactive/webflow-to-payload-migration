import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { writeFileAtomic } from "#lib/fs.ts";

import { runConfigSchema, type RunConfig } from "./schema.ts";

export const RUN_CONFIG_PATH = ".migration/run-config.json";

function runConfigFilePath(projectPath: string): string {
  return join(projectPath, RUN_CONFIG_PATH);
}

export async function loadRunConfig(projectPath: string): Promise<RunConfig> {
  const filePath = runConfigFilePath(projectPath);
  if (!existsSync(filePath)) {
    throw new Error(`run-config not found at ${filePath}. Create it before running the pipeline.`);
  }

  const raw: unknown = JSON.parse(await readFile(filePath, "utf8"));
  return runConfigSchema.parse(raw);
}

export async function writeRunConfig(projectPath: string, config: RunConfig): Promise<void> {
  await writeFileAtomic(runConfigFilePath(projectPath), `${JSON.stringify(config, null, 2)}\n`);
}
