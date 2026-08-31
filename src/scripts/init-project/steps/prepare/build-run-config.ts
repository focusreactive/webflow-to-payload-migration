import type { MigrateConfig } from "#lib/migrate-config/index.ts";
import { normalizeUrl } from "#lib/url.ts";
import { runConfigSchema, type RunConfig } from "#run-config/schema.ts";

export interface BuildRunConfigInput {
  url: string;
  projectName?: string;
  workspacePath?: string;
  fileConfig?: Partial<RunConfig>;
}

export function slugFromUrl(url: string): string {
  const hostname = new URL(normalizeUrl(url)).hostname;
  return hostname.replace(/^www\./, "").replace(/\./g, "-");
}

export function buildRunConfig(input: BuildRunConfigInput, config: MigrateConfig): RunConfig {
  const smartDefaults: Record<string, unknown> = {
    sourceUrl: normalizeUrl(input.url),
    projectName: slugFromUrl(input.url),
    workspacePath: config.workspace.path,
  };

  const fileConfig: Record<string, unknown> = input.fileConfig ?? {};

  const explicitFlags: Record<string, unknown> = {};
  if (input.projectName !== undefined) {
    explicitFlags["projectName"] = input.projectName;
  }
  if (input.workspacePath !== undefined) {
    explicitFlags["workspacePath"] = input.workspacePath;
  }

  const merged: unknown = {
    ...smartDefaults,
    ...fileConfig,
    ...explicitFlags,
  };

  return runConfigSchema.parse(merged);
}
