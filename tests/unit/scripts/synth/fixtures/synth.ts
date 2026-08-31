import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { synthEntryDir, type Vertical } from "#lib/synth-store/paths.ts";

export async function synthProject(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `${prefix}-`));
}

export async function writeShard(
  projectPath: string,
  vertical: Vertical,
  entityKey: string,
  file: string,
  value: unknown,
): Promise<void> {
  const dir = synthEntryDir(projectPath, vertical, entityKey);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, file), JSON.stringify(value));
}
