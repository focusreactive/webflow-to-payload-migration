import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import type { ClassifiedPage } from '#adapters/shared/pages.ts';
import { buildPagesData } from '#adapters/shared/pages.ts';
import { collectSitemapUrls } from '#adapters/shared/sitemap-collect.ts';
import { crawlWebflow, type SeedUrl } from '#adapters/webflow/crawl.ts';
import { detectPlatform } from '#detect/detect-platform.ts';
import { readArtifact, writeArtifact } from '#ir/artifact.ts';
import { detectArtifact } from '#ir/detect.ts';
import { pagesArtifact } from '#ir/pages.ts';
import { toolRootDir, loadMigrateConfig } from '#lib/migrate-config/index.ts';
import { SETTLE_MS, VIEWPORTS } from '#lib/capture/defaults.ts';
import { CONCURRENCY, REQUEST_DELAY_MS, TIMEOUT_MS, USER_AGENT } from '#lib/crawl-defaults.ts';
import { createFetchClient } from '#lib/fetch/create-fetch-client/index.ts';
import { writeFileAtomic } from '#lib/fs.ts';
import { extractAnchorHrefs } from '#lib/html.ts';
import { createLogger, type Logger } from '#lib/logger.ts';
import { parseSitemap } from '#lib/sitemap.ts';
import { normalizeUrl } from '#lib/url.ts';
import { HTTP_ERROR_STATUS_THRESHOLD } from '#probe/constants/http.ts';
import { PROBE_PATHS } from '#probe/constants/paths.ts';
import {
  fetchProbeTargets,
  type ProbeFetch,
} from '#probe/steps/probe/fetch-probe-targets.ts';
import { probeSite } from '#probe/steps/probe/probe-site.ts';
import { toProbeHttpSnapshot } from '#probe/steps/probe/write-home-headers.ts';
import { readProbeData } from '#probe/read-probe-data.ts';
import { buildRunConfig } from '#init-project/steps/prepare/build-run-config.ts';
import { initProject } from '#init-project/steps/init/init-project.ts';
import {
  FREEZE_MOTION,
  LARGE_PNG_WARN_BYTES,
  NEUTRALIZE_STICKY,
  PRE_SCROLL_REMEASURE,
} from '#snapshot/constants/capture-flags.ts';
import { createPlaywrightDriver } from '#snapshot/create-playwright-driver.ts';
import { snapshotSite } from '#snapshot/snapshot-site.ts';
import { openSnapshotStore } from '#lib/snapshot-store/index.ts';
import { SNAPSHOT_DIR } from '#lib/snapshot-store/paths.ts';
import type { SnapshotStore } from '#lib/snapshot-store/types.ts';

const DETECTION_GROUPS = ['webflow', 'negative'] as const;
type DetectionGroup = (typeof DETECTION_GROUPS)[number];

function isDetectionGroup(value: string): value is DetectionGroup {
  return (DETECTION_GROUPS as readonly string[]).includes(value);
}

const INVENTORY_PLATFORMS = ['webflow'] as const;
type InventoryPlatform = (typeof INVENTORY_PLATFORMS)[number];

function isInventoryPlatform(value: string): value is InventoryPlatform {
  return (INVENTORY_PLATFORMS as readonly string[]).includes(value);
}

const DEFAULT_MAX_PAGES = 20;
const SNAPSHOT_DEFAULT_MAX_PAGES = 5;

interface CollectArgValues {
  url?: string;
  group?: string;
  name?: string;
  platform?: string;
  'max-pages'?: string;
}

function usage(): string {
  return (
    'Usage: pnpm tsx tests/fixtures/collect.ts detection --url <url> ' +
    `--group ${DETECTION_GROUPS.join('|')} --name <slug>`
  );
}

function inventoryUsage(): string {
  return (
    'Usage: pnpm tsx tests/fixtures/collect.ts inventory --url <url> ' +
    `--platform ${INVENTORY_PLATFORMS.join('|')} --name <slug> [--max-pages N]`
  );
}

interface DetectionCollectArgs {
  url: string;
  group: DetectionGroup;
  name: string;
}

function parseDetectionCollectArgs(values: CollectArgValues): DetectionCollectArgs {
  const { url, group, name } = values;
  if (typeof url !== 'string' || url === '') {
    throw new Error(`--url is required\n${usage()}`);
  }
  if (typeof group !== 'string' || !isDetectionGroup(group)) {
    throw new Error(`--group must be one of ${DETECTION_GROUPS.join('|')}\n${usage()}`);
  }
  if (typeof name !== 'string' || name === '') {
    throw new Error(`--name is required\n${usage()}`);
  }

  return { url, group, name };
}

interface InventoryCollectArgs {
  url: string;
  platform: InventoryPlatform;
  name: string;
  maxPages: number;
}

function parseInventoryCollectArgs(
  values: CollectArgValues,
): InventoryCollectArgs {
  const { url, platform, name } = values;
  if (typeof url !== 'string' || url === '') {
    throw new Error(`--url is required\n${inventoryUsage()}`);
  }
  if (typeof platform !== 'string' || !isInventoryPlatform(platform)) {
    throw new Error(
      `--platform must be one of ${INVENTORY_PLATFORMS.join('|')}\n${inventoryUsage()}`,
    );
  }
  if (typeof name !== 'string' || name === '') {
    throw new Error(`--name is required\n${inventoryUsage()}`);
  }

  const maxPagesRaw = values['max-pages'];
  const maxPages =
    maxPagesRaw === undefined ? DEFAULT_MAX_PAGES : Number(maxPagesRaw);
  if (!Number.isInteger(maxPages) || maxPages <= 0) {
    throw new Error(`--max-pages must be a positive integer\n${inventoryUsage()}`);
  }

  return { url, platform, name, maxPages };
}

/** Maps a probe relativePath (e.g. PROBE_PATHS.robots === 'probe/robots.txt')
 * to the flat fixture file name it corresponds to (e.g. 'robots.txt'). */
function fixtureFileName(relativePath: string): string {
  return relativePath.replace(/^probe\//, '');
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function collectDetectionFixture(args: DetectionCollectArgs): Promise<void> {
  const sourceUrl = normalizeUrl(args.url);
  const fixtureDir = join(import.meta.dirname, 'detection', args.group, args.name);

  const logger = createLogger({ level: 'info' });
  const client = createFetchClient({
    concurrency: CONCURRENCY,
    requestDelayMs: REQUEST_DELAY_MS,
    timeoutMs: TIMEOUT_MS,
    userAgent: USER_AGENT,
    logger,
  });

  const fetch: ProbeFetch = async (url, relativePath) => {
    const response = await client.fetch(url);
    const fileName = fixtureFileName(relativePath);

    // home and not-found are always recorded (they describe the actual
    // response, including error statuses); robots/sitemap are only kept
    // when they actually resolved, matching ProbeData's own semantics where
    // robotsTxt/sitemapXml are omitted on a >=400 response.
    const isAlwaysRecorded =
      relativePath === PROBE_PATHS.home || relativePath === PROBE_PATHS.notFound;
    if (isAlwaysRecorded || response.status < HTTP_ERROR_STATUS_THRESHOLD) {
      await writeFileAtomic(join(fixtureDir, fileName), response.body);
    }

    if (relativePath === PROBE_PATHS.home) {
      await writeJson(
        join(fixtureDir, 'home-http.json'),
        toProbeHttpSnapshot(response),
      );
    } else if (relativePath === PROBE_PATHS.notFound) {
      await writeJson(
        join(fixtureDir, 'not-found-http.json'),
        toProbeHttpSnapshot(response),
      );
    }

    return {
      status: response.status,
      readBody: () => Promise.resolve(response.body),
    };
  };

  await fetchProbeTargets({ sourceUrl, client, logger, fetch });

  await writeJson(join(fixtureDir, 'meta.json'), {
    sourceUrl,
    collectedAt: new Date().toISOString(),
  });

  logger.info('detection fixture collected', {
    group: args.group,
    name: args.name,
    dir: fixtureDir,
  });
}

interface CollectedPage {
  url: string;
  status: number;
  body: string;
}

function sameOrigin(url: string, origin: string): boolean {
  return new URL(url).origin === origin;
}

function resolveHref(href: string, baseUrl: string): string | undefined {
  try {
    return normalizeUrl(new URL(href, baseUrl).toString());
  } catch {
    return undefined;
  }
}

async function collectInventoryFixture(args: InventoryCollectArgs): Promise<void> {
  const sourceUrl = normalizeUrl(args.url);
  const origin = new URL(sourceUrl).origin;
  const fixtureDir = join(
    import.meta.dirname,
    'inventory',
    args.platform,
    args.name,
  );

  const logger = createLogger({ level: 'info' });
  const client = createFetchClient({
    concurrency: CONCURRENCY,
    requestDelayMs: REQUEST_DELAY_MS,
    timeoutMs: TIMEOUT_MS,
    userAgent: USER_AGENT,
    logger,
  });

  const pages: CollectedPage[] = [];
  const visited = new Set<string>();
  const queued = new Set<string>();

  async function fetchAndRecord(url: string): Promise<CollectedPage> {
    const response = await client.fetch(url);
    const page: CollectedPage = {
      url,
      status: response.status,
      body: response.body.toString('utf8'),
    };
    visited.add(url);
    pages.push(page);
    return page;
  }

  const sitemapUrl = normalizeUrl(new URL('/sitemap.xml', sourceUrl).toString());
  const rootSitemap = await fetchAndRecord(sitemapUrl);

  const seeds: string[] = [sourceUrl];
  if (rootSitemap.status < HTTP_ERROR_STATUS_THRESHOLD) {
    await writeFileAtomic(join(fixtureDir, 'sitemap.xml'), rootSitemap.body);
    const parsed = parseSitemap(rootSitemap.body);

    if (parsed.kind === 'urlset') {
      seeds.push(...parsed.entries.map((entry) => entry.loc));
    } else if (parsed.kind === 'sitemapindex') {
      // Recurse exactly one level into a sitemapindex's child sitemaps.
      for (const entry of parsed.entries) {
        if (pages.length >= args.maxPages) break;
        const childUrl = normalizeUrl(entry.loc);
        if (visited.has(childUrl)) continue;

        const child = await fetchAndRecord(childUrl);
        if (child.status < HTTP_ERROR_STATUS_THRESHOLD) {
          const childParsed = parseSitemap(child.body);
          if (childParsed.kind === 'urlset') {
            seeds.push(...childParsed.entries.map((childEntry) => childEntry.loc));
          }
        }
      }
    }
  }

  const queue: string[] = [];
  for (const seed of seeds) {
    const normalized = normalizeUrl(seed);
    if (sameOrigin(normalized, origin) && !queued.has(normalized)) {
      queue.push(normalized);
      queued.add(normalized);
    }
  }

  let cursor = 0;
  while (cursor < queue.length && pages.length < args.maxPages) {
    const url = queue[cursor];
    cursor++;
    if (url === undefined || visited.has(url)) continue;

    const page = await fetchAndRecord(url);

    for (const href of extractAnchorHrefs(page.body)) {
      const resolved = resolveHref(href, url);
      if (resolved === undefined) continue;
      if (!sameOrigin(resolved, origin)) continue;
      if (visited.has(resolved) || queued.has(resolved)) continue;

      queue.push(resolved);
      queued.add(resolved);
    }
  }

  await writeFileAtomic(join(fixtureDir, 'sourceUrl.txt'), `${sourceUrl}\n`);

  for (const [index, page] of pages.entries()) {
    await writeJson(join(fixtureDir, 'pages', `${index}.json`), page);
  }

  logger.info('inventory fixture collected', {
    platform: args.platform,
    name: args.name,
    dir: fixtureDir,
    pages: pages.length,
  });
}

interface SnapshotCollectArgs {
  url: string;
  platform: InventoryPlatform;
  name: string;
  maxPages: number;
}

function snapshotUsage(): string {
  return (
    'Usage: pnpm tsx tests/fixtures/collect.ts snapshot --url <url> ' +
    `--platform ${INVENTORY_PLATFORMS.join('|')} --name <slug> ` +
    '[--max-pages N]'
  );
}

function parseSnapshotCollectArgs(values: CollectArgValues): SnapshotCollectArgs {
  const { url, platform, name } = values;
  if (typeof url !== 'string' || url === '') {
    throw new Error(`--url is required\n${snapshotUsage()}`);
  }
  if (typeof platform !== 'string' || !isInventoryPlatform(platform)) {
    throw new Error(
      `--platform must be one of ${INVENTORY_PLATFORMS.join('|')}\n${snapshotUsage()}`,
    );
  }
  if (typeof name !== 'string' || name === '') {
    throw new Error(`--name is required\n${snapshotUsage()}`);
  }

  const maxPagesRaw = values['max-pages'];
  const maxPages =
    maxPagesRaw === undefined ? SNAPSHOT_DEFAULT_MAX_PAGES : Number(maxPagesRaw);
  if (!Number.isInteger(maxPages) || maxPages <= 0) {
    throw new Error(`--max-pages must be a positive integer\n${snapshotUsage()}`);
  }

  return { url, platform, name, maxPages };
}

// Content dirs always worth copying into the repo fixture. 'assets' is
// deliberately excluded (large, regenerable, rarely needed by consumers of
// mini-snapshot fixtures).
const SNAPSHOT_FIXTURE_ENTRIES = [
  'index.json',
  'probe',
  'pages',
  'styles',
  'scripts',
  'data',
] as const;

type CrawlOutcome = { pages: ClassifiedPage[]; warnings: string[] };

async function crawlByPlatform(opts: {
  origin: string;
  sourceUrl: string;
  sitemapUrls: string[];
  store: SnapshotStore;
  maxPages: number;
  logger: Logger;
}): Promise<CrawlOutcome> {
  const { origin, sourceUrl, sitemapUrls, store, maxPages, logger } = opts;

  const seedUrls: SeedUrl[] = [
    { url: sourceUrl, source: 'crawl' },
    ...sitemapUrls.map((url): SeedUrl => ({ url, source: 'sitemap' })),
  ];
  return crawlWebflow({ origin, seedUrls, store, maxPages, logger });
}

/** Runs the real pipeline (probe -> detect -> inventory -> snapshot) against
 * a scratch project outside the repo, then copies the resulting snapshot
 * directory into the committed fixture location. The adapter used for
 * inventory is picked from --platform directly (not from the detect
 * verdict), so the collector stays deterministic regardless of detection
 * heuristics. */
async function collectSnapshotFixture(args: SnapshotCollectArgs): Promise<void> {
  const config = loadMigrateConfig();
  const logger = createLogger({ level: 'info' });

  // Scratch workspace lives under the OS temp dir, never under tests/ — it
  // is only a means to drive the real services and is deleted afterward.
  const workspacePath = await mkdtemp(
    join(tmpdir(), 'migrate-snapshot-fixture-'),
  );

  try {
    const runConfig = buildRunConfig(
      {
        url: args.url,
        workspacePath,
        projectName: 'project',
      },
      config,
    );

    const { projectPath } = await initProject(runConfig, {
      toolRootDir: toolRootDir(),
      // Manifest is never read back once the snapshot dir is copied out, so
      // a fixed placeholder is fine here.
      toolVersion: 'snapshot-fixture-collector',
    });

    const client = createFetchClient({
      concurrency: CONCURRENCY,
      requestDelayMs: REQUEST_DELAY_MS,
      timeoutMs: TIMEOUT_MS,
      userAgent: USER_AGENT,
      logger,
    });

    const store = await openSnapshotStore(projectPath, client);

    // 1. probe
    await probeSite({
      projectPath,
      sourceUrl: runConfig.sourceUrl,
      store,
      client,
      logger,
    });

    // 2. detect
    const probeData = await readProbeData(projectPath);
    const detect = detectPlatform(probeData);
    await writeArtifact(projectPath, detectArtifact, {
      provenance: 'published',
      data: detect,
    });

    // 3. inventory (adapter chosen by --platform)
    const origin = new URL(runConfig.sourceUrl).origin;
    const sitemapUrls = await collectSitemapUrls({
      rootSitemapXml: probeData.sitemapXml,
      store,
      logger,
    });

    const { pages: classifiedPages, warnings } = await crawlByPlatform({
      origin,
      sourceUrl: runConfig.sourceUrl,
      sitemapUrls,
      store,
      maxPages: args.maxPages,
      logger,
    });

    if (warnings.length > 0) {
      logger.info('snapshot fixture: crawl finished with warnings', {
        warningCount: warnings.length,
      });
    }

    const pagesData = buildPagesData(classifiedPages);
    await writeArtifact(projectPath, pagesArtifact, {
      provenance: 'published',
      data: pagesData,
    });

    // 4. snapshot
    const { data: pages } = await readArtifact(projectPath, pagesArtifact);

    const driver = createPlaywrightDriver();
    try {
      await snapshotSite({
        projectPath,
        origin,
        pages,
        store,
        driver,
        viewports: VIEWPORTS,
        settleMs: SETTLE_MS,
        captureStabilization: {
          freezeMotion: FREEZE_MOTION,
          neutralizeSticky: NEUTRALIZE_STICKY,
          preScrollRemeasure: PRE_SCROLL_REMEASURE,
        },
        largePngWarnBytes: LARGE_PNG_WARN_BYTES,
        logger,
      });
    } finally {
      await driver.close();
    }

    // 5. copy the resulting snapshot directory into the committed fixture
    const fixtureDir = join(
      import.meta.dirname,
      'snapshots',
      args.platform,
      args.name,
    );
    const snapshotSrcDir = join(projectPath, SNAPSHOT_DIR);
    await mkdir(fixtureDir, { recursive: true });

    for (const entry of SNAPSHOT_FIXTURE_ENTRIES) {
      const src = join(snapshotSrcDir, entry);
      if (!existsSync(src)) continue;
      await cp(src, join(fixtureDir, entry), { recursive: true });
    }

    logger.info('snapshot fixture collected', {
      platform: args.platform,
      name: args.name,
      dir: fixtureDir,
      pages: pages.pages.length,
    });
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
}

const ALL_OPTIONS = {
  url: { type: 'string' },
  group: { type: 'string' },
  name: { type: 'string' },
  platform: { type: 'string' },
  'max-pages': { type: 'string' },
} as const;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: ALL_OPTIONS,
  });

  const mode = positionals[0];
  if (mode === 'detection') {
    await collectDetectionFixture(parseDetectionCollectArgs(values));
  } else if (mode === 'inventory') {
    await collectInventoryFixture(parseInventoryCollectArgs(values));
  } else if (mode === 'snapshot') {
    await collectSnapshotFixture(parseSnapshotCollectArgs(values));
  } else {
    throw new Error(
      `Unsupported or missing mode.\n${usage()}\n${inventoryUsage()}\n${snapshotUsage()}`,
    );
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
