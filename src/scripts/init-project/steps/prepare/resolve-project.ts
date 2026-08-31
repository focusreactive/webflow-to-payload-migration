import { existsSync } from "node:fs";

import type { RunConfig } from "#run-config/schema.ts";
import { projectPathFor, readManifestSummary, safeNormalizeUrl } from "./utils/resolve-project.ts";

export type ProjectVerdict = "new" | "existing" | "collision";

export interface ManifestSummary {
  sourceUrl: string;
  toolVersion: string;
  initProject: "done" | "pending";
}

export interface ResolvedProject {
  projectPath: string;
  verdict: ProjectVerdict;
  manifest: ManifestSummary | null;
}

export async function resolveProject(runConfig: RunConfig, opts: { toolRootDir: string }): Promise<ResolvedProject> {
  const projectPath = projectPathFor(runConfig, opts);
  const manifest = await readManifestSummary(projectPath);

  if (manifest === null) {
    return { projectPath, verdict: existsSync(projectPath) ? "collision" : "new", manifest: null };
  }

  const sameSource = safeNormalizeUrl(manifest.sourceUrl) === safeNormalizeUrl(runConfig.sourceUrl);

  return { projectPath, verdict: sameSource ? "existing" : "collision", manifest };
}
