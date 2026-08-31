import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { writeFileAtomic } from "#lib/fs.ts";
import { MANIFEST_SCHEMA_VERSION, manifestSchema, type Manifest, type StepRecord } from "#lib/manifest/schema.ts";

export class ManifestVersionError extends Error {
  constructor(opts: { found: number; expected: number }) {
    super(
      `manifest.json has schemaVersion ${opts.found}, this tool expects ${opts.expected}. `
        + `There are no automatic migrations: re-run the pipeline from a fresh project `
        + `or use a tool version matching the manifest.`,
    );
    this.name = "ManifestVersionError";
  }
}

function manifestPath(projectPath: string): string {
  return join(projectPath, ".migration", "manifest.json");
}

async function writeManifest(projectPath: string, manifest: Manifest): Promise<void> {
  await writeFileAtomic(manifestPath(projectPath), `${JSON.stringify(manifest, null, 2)}\n`);
}

const versionProbeSchema = z.looseObject({ schemaVersion: z.number() });

export async function readManifest(projectPath: string): Promise<Manifest> {
  const raw: unknown = JSON.parse(await readFile(manifestPath(projectPath), "utf8"));

  const probe = versionProbeSchema.parse(raw);
  if (probe.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new ManifestVersionError({
      found: probe.schemaVersion,
      expected: MANIFEST_SCHEMA_VERSION,
    });
  }

  return manifestSchema.parse(raw);
}

export async function initManifest(
  projectPath: string,
  init: { toolVersion: string; sourceUrl: string; localOnly: boolean },
): Promise<void> {
  await writeManifest(projectPath, {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    toolVersion: init.toolVersion,
    sourceUrl: init.sourceUrl,
    localOnly: init.localOnly,
    steps: {},
  });
}

export async function clearStepsByPrefix(projectPath: string, prefix: string): Promise<void> {
  const manifest = await readManifest(projectPath);
  for (const stepId of Object.keys(manifest.steps)) {
    if (stepId.startsWith(prefix)) delete manifest.steps[stepId];
  }
  await writeManifest(projectPath, manifest);
}

export async function updateStep(projectPath: string, stepId: string, patch: Partial<StepRecord>): Promise<void> {
  const manifest = await readManifest(projectPath);
  const existing = manifest.steps[stepId] ?? { status: "pending" as const };
  manifest.steps[stepId] = stepRecordWithPatch(existing, patch);
  await writeManifest(projectPath, manifest);
}

function stepRecordWithPatch(existing: StepRecord, patch: Partial<StepRecord>): StepRecord {
  const merged = { ...existing, ...patch };
  // JSON.stringify drops explicit undefined, but the strict schema must not
  // see keys that a patch intentionally cleared.
  for (const key of Object.keys(merged) as (keyof StepRecord)[]) {
    if (merged[key] === undefined) delete merged[key];
  }
  return merged;
}

export async function recordArtifact(
  projectPath: string,
  stepId: string,
  artifactKind: string,
  filePath: string,
): Promise<void> {
  const sha256 = createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
  const manifest = await readManifest(projectPath);
  const existing = manifest.steps[stepId] ?? { status: "pending" as const };
  manifest.steps[stepId] = {
    ...existing,
    artifacts: { ...existing.artifacts, [artifactKind]: { path: filePath, sha256 } },
  };
  await writeManifest(projectPath, manifest);
}

export async function withStep<T>(
  projectPath: string,
  stepId: string,
  fn: () => Promise<T>,
  opts?: { force?: boolean },
): Promise<T | undefined> {
  const manifest = await readManifest(projectPath);
  if (manifest.steps[stepId]?.status === "done" && !opts?.force) {
    return undefined;
  }

  await updateStep(projectPath, stepId, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    const result = await fn();
    await updateStep(projectPath, stepId, {
      status: "done",
      finishedAt: new Date().toISOString(),
    });
    return result;
  } catch (error) {
    await updateStep(projectPath, stepId, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: errorRecord(error),
    });
    throw error;
  }
}

function errorRecord(error: unknown): NonNullable<StepRecord["error"]> {
  if (error instanceof Error) {
    return { code: error.name, message: error.message };
  }
  return { code: "UnknownError", message: String(error) };
}
