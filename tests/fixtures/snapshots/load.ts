import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { z } from 'zod';

import { snapshotIndexSchema } from '#lib/snapshot-store/schema.ts';

type SnapshotIndex = z.infer<typeof snapshotIndexSchema>;

export interface SnapshotFixture {
  dir: string;
  index: SnapshotIndex;
  readBody(rel: string): Promise<Buffer>;
}

function isEnoent(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

export async function loadSnapshotFixture(dir: string): Promise<SnapshotFixture> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'));
  } catch (error) {
    if (isEnoent(error)) {
      throw new Error(
        `snapshot fixture at ${dir} is missing required file: index.json`,
        { cause: error },
      );
    }
    throw error;
  }

  const index = snapshotIndexSchema.parse(raw);

  return {
    dir,
    index,
    readBody: (rel: string): Promise<Buffer> => readFile(join(dir, rel)),
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (isEnoent(error)) return false;
    throw error;
  }
}

async function listSubdirNames(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

export async function listSnapshotFixtures(): Promise<
  { platform: string; name: string; dir: string }[]
> {
  const root = import.meta.dirname;

  const results: { platform: string; name: string; dir: string }[] = [];

  for (const platform of await listSubdirNames(root)) {
    const platformDir = join(root, platform);
    for (const name of await listSubdirNames(platformDir)) {
      const dir = join(platformDir, name);
      if (await pathExists(join(dir, 'index.json'))) {
        results.push({ platform, name, dir });
      }
    }
  }

  results.sort(
    (a, b) =>
      a.platform.localeCompare(b.platform) || a.name.localeCompare(b.name),
  );

  return results;
}
