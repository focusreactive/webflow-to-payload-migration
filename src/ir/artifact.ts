import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { writeFileAtomic } from "#lib/fs.ts";
import { provenanceSchema, type Provenance } from "#ir/common.ts";

const ARTIFACTS_DIR = join(".migration", "artifacts");

export interface ArtifactDef<D> {
  kind: string;
  relativePath: string;
  schemaVersion: number;
  dataSchema: z.ZodType<D>;
}

export class ArtifactVersionError extends Error {
  constructor(opts: { kind: string; found: number; expected: number }) {
    super(
      `Artifact '${opts.kind}' has schemaVersion ${opts.found}, expected ${opts.expected}. `
        + `Re-run the step that produces '${opts.kind}' to regenerate it.`,
    );
    this.name = "ArtifactVersionError";
  }
}

export function artifactEnvelope<D extends z.ZodType>(dataSchema: D, schemaVersion: number) {
  return z.strictObject({
    schemaVersion: z.literal(schemaVersion),
    provenance: provenanceSchema,
    data: dataSchema,
  });
}

export function artifactPath(projectPath: string, def: ArtifactDef<unknown>): string {
  return join(projectPath, ARTIFACTS_DIR, def.relativePath);
}

export async function writeArtifact<D>(
  projectPath: string,
  def: ArtifactDef<D>,
  payload: { provenance: Provenance; data: D },
): Promise<void> {
  const envelope = artifactEnvelope(def.dataSchema, def.schemaVersion);
  const validated = envelope.parse({
    schemaVersion: def.schemaVersion,
    provenance: payload.provenance,
    data: payload.data,
  });
  await writeFileAtomic(artifactPath(projectPath, def), `${JSON.stringify(validated, null, 2)}\n`);
}

const versionProbeSchema = z.looseObject({ schemaVersion: z.number() });

export async function readArtifact<D>(
  projectPath: string,
  def: ArtifactDef<D>,
): Promise<{ provenance: Provenance; data: D }> {
  const raw: unknown = JSON.parse(await readFile(artifactPath(projectPath, def), "utf8"));

  const probe = versionProbeSchema.parse(raw);
  if (probe.schemaVersion !== def.schemaVersion) {
    throw new ArtifactVersionError({
      kind: def.kind,
      found: probe.schemaVersion,
      expected: def.schemaVersion,
    });
  }

  const envelope = artifactEnvelope(def.dataSchema, def.schemaVersion);
  const parsed = envelope.parse(raw);
  return { provenance: parsed.provenance, data: parsed.data };
}

const ndjsonMetaSchema = z.looseObject({
  kind: z.literal("meta"),
  schemaVersion: z.number(),
  provenance: provenanceSchema,
});
export type NdjsonMeta = z.infer<typeof ndjsonMetaSchema>;

export async function writeNdjsonArtifact<D>(
  projectPath: string,
  def: ArtifactDef<D>,
  payload: {
    provenance: Provenance;
    items: readonly D[];
    extraMeta?: Record<string, unknown>;
  },
): Promise<void> {
  const meta = {
    kind: "meta",
    schemaVersion: def.schemaVersion,
    provenance: payload.provenance,
    ...payload.extraMeta,
  };
  const lines = [JSON.stringify(meta), ...payload.items.map((item) => JSON.stringify(def.dataSchema.parse(item)))];
  await writeFileAtomic(artifactPath(projectPath, def), `${lines.join("\n")}\n`);
}

export async function readNdjsonArtifact<D>(
  projectPath: string,
  def: ArtifactDef<D>,
): Promise<{ meta: NdjsonMeta; items: D[] }> {
  const filePath = artifactPath(projectPath, def);
  const lines = (await readFile(filePath, "utf8")).split("\n").filter((line) => line !== "");

  const meta = parseNdjsonLine(filePath, lines[0], 1, ndjsonMetaSchema);
  if (meta.schemaVersion !== def.schemaVersion) {
    throw new ArtifactVersionError({
      kind: def.kind,
      found: meta.schemaVersion,
      expected: def.schemaVersion,
    });
  }

  const items = lines.slice(1).map((line, index) => parseNdjsonLine(filePath, line, index + 2, def.dataSchema));
  return { meta, items };
}

function parseNdjsonLine<T>(filePath: string, line: string | undefined, lineNumber: number, schema: z.ZodType<T>): T {
  try {
    if (line === undefined) throw new Error("missing line");
    return schema.parse(JSON.parse(line));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid NDJSON record at line ${lineNumber} of ${filePath}: ${reason}`, { cause: error });
  }
}
