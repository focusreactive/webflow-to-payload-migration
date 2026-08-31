import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { ProbeData } from '#probe/read-probe-data.ts';

interface DetectionMeta {
  sourceUrl: string;
  collectedAt: string;
}

function isEnoent(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

async function readOptionalText(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (isEnoent(error)) return undefined;
    throw error;
  }
}

async function readRequiredText(
  dir: string,
  fileName: string,
): Promise<string> {
  try {
    return await readFile(join(dir, fileName), 'utf8');
  } catch (error) {
    if (isEnoent(error)) {
      throw new Error(
        `detection fixture at ${dir} is missing required file: ${fileName}`,
        { cause: error },
      );
    }
    throw error;
  }
}

export async function loadDetectionFixture(dir: string): Promise<ProbeData> {
  const meta = JSON.parse(
    await readRequiredText(dir, 'meta.json'),
  ) as DetectionMeta;

  const homeHtml = await readRequiredText(dir, 'home.html');
  const homeHttp = JSON.parse(
    await readRequiredText(dir, 'home-http.json'),
  ) as ProbeData['homeHttp'];

  const robotsTxt = await readOptionalText(join(dir, 'robots.txt'));
  const sitemapXml = await readOptionalText(join(dir, 'sitemap.xml'));

  const notFoundHtml = await readOptionalText(join(dir, 'not-found.html'));
  const notFoundHttpRaw = await readOptionalText(
    join(dir, 'not-found-http.json'),
  );
  const notFound =
    notFoundHtml !== undefined && notFoundHttpRaw !== undefined
      ? {
          html: notFoundHtml,
          status: (JSON.parse(notFoundHttpRaw) as { status: number }).status,
        }
      : undefined;

  return {
    sourceUrl: meta.sourceUrl,
    homeHtml,
    homeHttp,
    ...(robotsTxt !== undefined && { robotsTxt }),
    ...(sitemapXml !== undefined && { sitemapXml }),
    ...(notFound !== undefined && { notFound }),
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

async function isFixtureDir(dir: string): Promise<boolean> {
  return (
    (await pathExists(join(dir, 'meta.json'))) ||
    (await pathExists(join(dir, 'expected.json')))
  );
}

async function listSubdirNames(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

export async function listDetectionFixtures(): Promise<
  { group: string; name: string; dir: string }[]
> {
  // Fixtures root is this file's own directory — deliberately not a
  // hardcoded absolute path, so it keeps working regardless of cwd.
  const root = import.meta.dirname;

  const results: { group: string; name: string; dir: string }[] = [];

  for (const group of await listSubdirNames(root)) {
    const groupDir = join(root, group);
    for (const name of await listSubdirNames(groupDir)) {
      const dir = join(groupDir, name);
      if (await isFixtureDir(dir)) {
        results.push({ group, name, dir });
      }
    }
  }

  results.sort(
    (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name),
  );

  return results;
}
