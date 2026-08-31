import { RunConfig } from "#run-config/schema.ts";
import { join, resolve } from "node:path";
import z from "zod";
import { ManifestSummary } from "../resolve-project.ts";
import { readFile } from "node:fs/promises";
import { INIT_PROJECT_STEP_ID } from "#init-project/constants/ids.ts";
import { normalizeUrl } from "#lib/url.ts";

export function projectPathFor(runConfig: RunConfig, opts: { toolRootDir: string }): string {
  return resolve(opts.toolRootDir, runConfig.workspacePath, runConfig.projectName);
}

const manifestProbeSchema = z.looseObject({
  sourceUrl: z.string(),
  toolVersion: z.string(),
  steps: z.record(z.string(), z.looseObject({ status: z.string() })).optional(),
});

export async function readManifestSummary(projectPath: string): Promise<ManifestSummary | null> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(projectPath, ".migration", "manifest.json"), "utf8"));
  } catch {
    return null;
  }

  const parsed = manifestProbeSchema.safeParse(raw);
  if (!parsed.success) return null;

  return {
    sourceUrl: parsed.data.sourceUrl,
    toolVersion: parsed.data.toolVersion,
    initProject: parsed.data.steps?.[INIT_PROJECT_STEP_ID]?.status === "done" ? "done" : "pending",
  };
}

export function safeNormalizeUrl(url: string): string {
  try {
    return normalizeUrl(url);
  } catch {
    return url;
  }
}
