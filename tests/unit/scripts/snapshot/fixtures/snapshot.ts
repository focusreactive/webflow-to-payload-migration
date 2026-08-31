import { PNG } from "pngjs";

import type { FetchClient, FetchResponse } from "#lib/fetch/create-fetch-client/index.ts";
import { createLogger, type Logger } from "#lib/logger.ts";
import type { BrowserDriver, RenderedPage, StitchedCapture } from "#snapshot/types.ts";

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

/** Fake FetchClient: resolves each URL against a lookup table and records
 * every call so tests can assert the network was (or wasn't) touched. */
export function createFakeFetchClient(responses: Record<string, FetchResponse>): FetchClient & { calls: string[] } {
  const calls: string[] = [];

  return {
    calls,
    fetch(url: string): Promise<FetchResponse> {
      calls.push(url);
      const response = responses[url];
      if (!response) {
        throw new Error(`fake client: no response configured for ${url}`);
      }
      return Promise.resolve(response);
    },
    setCrawlDelayMs(): void {},
  };
}

export function silentLogger(): Logger & { warnCalls: string[] } {
  const warnCalls: string[] = [];
  const base = createLogger({
    level: "error",
    stderr: { write: (): boolean => true } as unknown as NodeJS.WritableStream,
  });

  return {
    ...base,
    warnCalls,
    warn: (msg: string, data?: Record<string, unknown>): void => {
      warnCalls.push(msg);
      base.warn(msg, data);
    },
  };
}

export function fakeStitch(viewportWidth: number, docHeight: number): StitchedCapture {
  const png = new PNG({ width: viewportWidth, height: docHeight });
  return {
    buffer: PNG.sync.write(png),
    doc: { width: viewportWidth, height: docHeight },
    dpr: 1,
    pixels: { width: viewportWidth, height: docHeight },
    stickyRegions: [],
  };
}

/** Fake BrowserDriver: always returns the same fixed RenderedPage and
 * records every render() call so tests can assert per-page invocation. */
export function createFakeDriver(
  rendered: RenderedPage,
): BrowserDriver & { renderCalls: { url: string; settleMs: number }[] } {
  const renderCalls: { url: string; settleMs: number }[] = [];

  return {
    renderCalls,
    render({ url, settleMs }): Promise<RenderedPage> {
      renderCalls.push({ url, settleMs });
      return Promise.resolve(rendered);
    },
    close(): Promise<void> {
      return Promise.resolve();
    },
  };
}
