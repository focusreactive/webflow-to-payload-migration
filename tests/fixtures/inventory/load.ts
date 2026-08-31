import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { FetchClient, FetchResponse } from '#lib/fetch/create-fetch-client/index.ts';
import { normalizeUrl } from '#lib/url.ts';

export interface InventoryFixture {
  sourceUrl: string;
  fetchClient: FetchClient;
  rootSitemapXml?: string;
}

interface InventoryPageRecord {
  url: string;
  status?: number;
  body: string;
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
        `inventory fixture at ${dir} is missing required file: ${fileName}`,
        { cause: error },
      );
    }
    throw error;
  }
}

async function readPageRecords(dir: string): Promise<InventoryPageRecord[]> {
  const pagesDir = join(dir, 'pages');

  let entries;
  try {
    entries = await readdir(pagesDir, { withFileTypes: true });
  } catch (error) {
    if (isEnoent(error)) return [];
    throw error;
  }

  const records: InventoryPageRecord[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

    const filePath = join(pagesDir, entry.name);
    const raw = JSON.parse(
      await readFile(filePath, 'utf8'),
    ) as InventoryPageRecord;
    records.push(raw);
  }

  return records;
}

const NOT_FOUND_STATUS = 404;

function createFixtureFetchClient(records: InventoryPageRecord[]): FetchClient {
  const byUrl = new Map<string, InventoryPageRecord>();
  for (const record of records) {
    byUrl.set(normalizeUrl(record.url), record);
  }

  return {
    fetch(url: string): Promise<FetchResponse> {
      const normalized = normalizeUrl(url);
      const record = byUrl.get(normalized);

      if (!record) {
        return Promise.resolve({
          status: NOT_FOUND_STATUS,
          finalUrl: normalized,
          redirectChain: [],
          headers: { 'content-type': 'text/html' },
          body: Buffer.alloc(0),
        });
      }

      return Promise.resolve({
        status: record.status ?? 200,
        finalUrl: normalized,
        redirectChain: [],
        headers: { 'content-type': 'text/html' },
        body: Buffer.from(record.body),
      });
    },
    setCrawlDelayMs(): void {},
  };
}

export async function loadInventoryFixture(
  dir: string,
): Promise<InventoryFixture> {
  const sourceUrl = (await readRequiredText(dir, 'sourceUrl.txt')).trim();
  const rootSitemapXml = await readOptionalText(join(dir, 'sitemap.xml'));
  const records = await readPageRecords(dir);
  const fetchClient = createFixtureFetchClient(records);

  return {
    sourceUrl,
    fetchClient,
    ...(rootSitemapXml !== undefined && { rootSitemapXml }),
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
    (await pathExists(join(dir, 'sourceUrl.txt'))) ||
    (await pathExists(join(dir, 'expected-pages.json')))
  );
}

async function listSubdirNames(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

export async function listInventoryFixtures(): Promise<
  { platform: string; name: string; dir: string }[]
> {
  // Fixtures root is this file's own directory — deliberately not a
  // hardcoded absolute path, so it keeps working regardless of cwd.
  const root = import.meta.dirname;

  const results: { platform: string; name: string; dir: string }[] = [];

  for (const platform of await listSubdirNames(root)) {
    const platformDir = join(root, platform);
    for (const name of await listSubdirNames(platformDir)) {
      const dir = join(platformDir, name);
      if (await isFixtureDir(dir)) {
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
