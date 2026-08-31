import type { FetchClient, FetchResponse } from "#lib/fetch/create-fetch-client/index.ts";
import { PROBE_404_PATH } from "#probe/constants/paths.ts";
import { createLogger, type Logger } from "#lib/logger.ts";
import { writeRunConfig } from "#run-config/load.ts";
import type { RunConfig } from "#run-config/schema.ts";

export const ORIGIN = "https://example.com";
export const SOURCE_URL = `${ORIGIN}/`;
export const ROBOTS_URL = `${ORIGIN}/robots.txt`;
export const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;
export const NOT_FOUND_URL = `${ORIGIN}${PROBE_404_PATH}`;

export function fetchResponse(url: string, overrides: Partial<FetchResponse> = {}): FetchResponse {
  return {
    status: 200,
    finalUrl: url,
    redirectChain: [],
    headers: {},
    body: Buffer.from(`body for ${url}`),
    ...overrides,
  };
}

export type FakeFetchClient = FetchClient & { calls: string[]; crawlDelayCalls: number[] };

/** Fake FetchClient: resolves each URL against a lookup table and records
 * every fetch/crawl-delay call so tests can assert on network behavior. */
export function createFakeFetchClient(responses: Record<string, FetchResponse>): FakeFetchClient {
  const calls: string[] = [];
  const crawlDelayCalls: number[] = [];

  return {
    calls,
    crawlDelayCalls,
    fetch(url: string): Promise<FetchResponse> {
      calls.push(url);
      const response = responses[url];
      if (!response) {
        throw new Error(`fake client: no response configured for ${url}`);
      }
      return Promise.resolve(response);
    },
    setCrawlDelayMs(ms: number): void {
      crawlDelayCalls.push(ms);
    },
  };
}

export function silentLogger(): Logger {
  return createLogger({
    level: "error",
    stderr: { write: (): boolean => true } as unknown as NodeJS.WritableStream,
  });
}

export async function writeConfig(projectPath: string, overrides: Partial<RunConfig> = {}): Promise<void> {
  await writeRunConfig(projectPath, {
    sourceUrl: SOURCE_URL,
    projectName: "example-com",
    workspacePath: ".",
    ...overrides,
  });
}
