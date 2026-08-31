import { ResolvedProject, resolveProject } from "#init-project/steps/prepare/resolve-project.ts";
import { RunConfig } from "#run-config/schema.ts";
import { InitResult } from "./init.ts";
import { ProjectCollisionError } from "./project-collision-error.ts";
import { createProject } from "./create-project.ts";
import { INIT_PROJECT_STEP_ID } from "#init-project/constants/ids.ts";
import { updateStep } from "#lib/manifest/index.ts";

export async function initProject(
  runConfig: RunConfig,
  opts: { toolRootDir: string; toolVersion: string },
): Promise<InitResult> {
  const resolved = await resolveProject(runConfig, { toolRootDir: opts.toolRootDir });

  if (resolved.verdict === "collision") {
    throw new ProjectCollisionError({
      projectPath: resolved.projectPath,
      sourceUrl: runConfig.sourceUrl,
      occupiedBy: resolved.manifest?.sourceUrl ?? null,
    });
  }

  if (resolved.verdict === "existing") {
    await adoptProject(resolved);
    return { projectPath: resolved.projectPath, created: false };
  }

  await createProject({
    projectPath: resolved.projectPath,
    runConfig,
    toolVersion: opts.toolVersion,
  });

  return { projectPath: resolved.projectPath, created: true };
}

async function adoptProject(resolved: ResolvedProject): Promise<void> {
  if (resolved.manifest?.initProject === "done") return;

  await updateStep(resolved.projectPath, INIT_PROJECT_STEP_ID, {
    status: "done",
    finishedAt: new Date().toISOString(),
  });
}
