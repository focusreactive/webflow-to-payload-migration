import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { writeFileAtomic } from "#lib/fs.ts";

export type Vertical = "collections" | "globals" | "blocks";
export const SYNTH_DIR = join(".migration", "artifacts", "synth");

export function synthVerticalDir(projectPath: string, vertical: Vertical): string {
  return join(projectPath, SYNTH_DIR, vertical);
}

export function synthEntryDir(projectPath: string, vertical: Vertical, entity: string): string {
  return join(synthVerticalDir(projectPath, vertical), entity);
}

export function entityDirsFor(projectPath: string, vertical: Vertical): string[] {
  const dir = synthVerticalDir(projectPath, vertical);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export async function readShardJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function writeShardJson(path: string, value: unknown): Promise<void> {
  await writeFileAtomic(path, JSON.stringify(value, null, 2) + "\n");
}
