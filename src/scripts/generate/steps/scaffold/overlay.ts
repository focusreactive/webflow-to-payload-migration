import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { writeFileAtomic } from "#lib/fs.ts";

import { DELIVERABLE_FILES_ARTIFACT_PATH } from "../../constants/paths.ts";

import { assertNoRouteCollision } from "./utils/overlay.ts";

export interface OverlayDraft {
  template: (relativePath: string, content: string) => void;
  emit: (relativePath: string, content: string | Buffer) => void;
}

export function createOverlayDraft(): {
  draft: OverlayDraft;
  templates: Map<string, string>;
  emitted: Map<string, string | Buffer>;
} {
  const templates = new Map<string, string>();
  const emitted = new Map<string, string | Buffer>();
  return {
    templates,
    emitted,
    draft: {
      template: (relativePath, content) => templates.set(relativePath, content),
      emit: (relativePath, content) => emitted.set(relativePath, content),
    },
  };
}

export function assertLayerSeams(opts: {
  projectPath: string;
  templates: ReadonlyMap<string, string>;
  emitted: ReadonlyMap<string, string | Buffer>;
  previouslyWritten: readonly string[];
}): void {
  const allowed = new Set<string>(opts.previouslyWritten);
  const collisions = [...opts.emitted.keys()].filter(
    (relativePath) => existsSync(join(opts.projectPath, relativePath)) && !allowed.has(relativePath),
  );
  if (collisions.length > 0) {
    throw new Error(
      "emission would overwrite files this tool did not write:\n" + collisions.map((path) => `  ${path}`).join("\n"),
    );
  }

  assertNoRouteCollision(opts);
}

export async function readPreviouslyWritten(projectPath: string): Promise<string[]> {
  const artifact = join(projectPath, DELIVERABLE_FILES_ARTIFACT_PATH);
  if (!existsSync(artifact)) return [];
  const raw: unknown = JSON.parse(await readFile(artifact, "utf8"));
  if (typeof raw !== "object" || raw === null || !("files" in raw)) return [];
  const { files }: { files: unknown } = raw;
  return Array.isArray(files) ? files.filter((entry: unknown): entry is string => typeof entry === "string") : [];
}

export async function writeOverlay(opts: {
  projectPath: string;
  templates: ReadonlyMap<string, string>;
  emitted: ReadonlyMap<string, string | Buffer>;
  previouslyWritten: readonly string[];
}): Promise<{ files: string[]; removed: string[] }> {
  assertLayerSeams(opts);

  for (const [relativePath, content] of [...opts.templates, ...opts.emitted]) {
    await writeFileAtomic(join(opts.projectPath, relativePath), content);
  }

  const written = new Set([...opts.templates.keys(), ...opts.emitted.keys()]);
  const removed: string[] = [];
  for (const relativePath of opts.previouslyWritten) {
    if (written.has(relativePath)) continue;
    await rm(join(opts.projectPath, relativePath), { force: true });
    removed.push(relativePath);
  }

  return { files: [...written].sort(), removed: removed.sort() };
}
