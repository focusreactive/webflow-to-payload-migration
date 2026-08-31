import { readFile } from "node:fs/promises";
import { relative } from "node:path";

import { readArtifact } from "#ir/artifact.ts";
import { mediaAssetsArtifact } from "#ir/assets.ts";
import { writeSurfaceRecord, type SurfaceCheck } from "#lib/surface-record/index.ts";

import { componentPath, inputPath } from "../../constants/paths.ts";
import type { EntityAddress, SynthVertical } from "../../types.ts";
import { printJson } from "../../utils/print-json.ts";

import { checkAssetsResolve, checkHarnessRenders, checkInputCovered, checkInputUsed, checkSyntax } from "./checks.ts";

const STEP_ID = "synth:accept";

// The harness renders a block, a global or a collection detail; the vertical
// names the same three things in its own plural vocabulary.
const HARNESS_KIND = { blocks: "block", globals: "global", collections: "detail" } as const;

function harnessUrl(opts: {
  harnessOrigin: string;
  vertical: SynthVertical;
  projectPath: string;
  entry: string;
  input: string;
}): string {
  const kind = HARNESS_KIND[opts.vertical.id];
  const entry = relative(opts.projectPath, opts.entry);
  return (
    `${opts.harnessOrigin}/?kind=${kind}`
    + `&entry=${encodeURIComponent(entry)}`
    + `&input=${encodeURIComponent(`/@fs${opts.input}`)}`
  );
}

async function knownAssetIds(projectPath: string): Promise<ReadonlySet<string>> {
  try {
    const { data } = await readArtifact(projectPath, mediaAssetsArtifact);
    return new Set(data.assets.map((asset) => asset.assetId));
  } catch {
    // No media inventory yet — a surface that references no asset still accepts,
    // and one that references an asset fails the check, which is the honest answer.
    return new Set<string>();
  }
}

export async function runAccept(opts: {
  projectPath: string;
  vertical: SynthVertical;
  address: EntityAddress;
  harnessOrigin: string;
}): Promise<void> {
  const { projectPath, vertical, address } = opts;
  const surface = vertical.surfaceKey(address);

  const componentFile = componentPath(projectPath, vertical.id, surface);
  const inputFile = inputPath(projectPath, vertical.id, surface);

  const source = await readFile(componentFile, "utf8");
  const input = JSON.parse(await readFile(inputFile, "utf8")) as Record<string, unknown>;
  const fieldNames = (await vertical.surfaceFields(projectPath, address)).map((field) => field.name);

  const checks: SurfaceCheck[] = [
    await checkSyntax(source),
    checkInputCovered(fieldNames, input),
    checkInputUsed(input, source),
    checkAssetsResolve(input, await knownAssetIds(projectPath)),
    await checkHarnessRenders(
      harnessUrl({
        harnessOrigin: opts.harnessOrigin,
        vertical,
        projectPath,
        entry: componentFile,
        input: inputFile,
      }),
    ),
  ];

  const accepted = checks.every((check) => check.ok);
  printJson({ step: STEP_ID, vertical: vertical.id, surface, accepted, checks });

  if (!accepted) {
    for (const check of checks.filter((entry) => !entry.ok)) {
      process.stderr.write(`${check.name}: ${check.detail}\n`);
    }
    process.exitCode = 1;
    return;
  }

  await writeSurfaceRecord(projectPath, vertical.id, surface, {
    surface,
    phase: "done",
    acceptedAt: new Date().toISOString(),
    checks,
  });
}
