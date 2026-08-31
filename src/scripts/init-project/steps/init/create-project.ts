import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { writeFileAtomic } from "#lib/fs.ts";
import { initManifest, withStep } from "#lib/manifest/index.ts";
import { writeRunConfig } from "#run-config/load.ts";
import type { RunConfig } from "#run-config/schema.ts";

import { INIT_PROJECT_STEP_ID } from "../../constants/ids.ts";

const GITIGNORE_CONTENT = [
  ".migration/snapshot/",
  ".migration/verification/",
  ".migration/logs/",
  ".migration/.env",
  ".env",
  "",
].join("\n");

export async function createProject(opts: {
  projectPath: string;
  runConfig: RunConfig;
  toolVersion: string;
}): Promise<void> {
  await mkdir(join(opts.projectPath, ".migration"), { recursive: true });

  await initManifest(opts.projectPath, {
    toolVersion: opts.toolVersion,
    sourceUrl: opts.runConfig.sourceUrl,
  });

  await withStep(opts.projectPath, INIT_PROJECT_STEP_ID, async () => {
    await writeRunConfig(opts.projectPath, opts.runConfig);
    await writeFileAtomic(resolve(opts.projectPath, ".gitignore"), GITIGNORE_CONTENT);
  });
}
