import { BACKOFF_MULTIPLIER, INITIAL_BACKOFF_MS, MAX_REDIRECTS, MAX_RETRIES, REDIRECT_STATUSES } from "./constants.ts";
import { defaultSleep, headersToRecord, isRetryableStatus } from "./utils.ts";
import type { FetchClient, FetchClientOptions, FetchResponse, HopResult } from "./types.ts";

export type { FetchClient, FetchResponse } from "./types.ts";

export function createFetchClient({
  concurrency,
  requestDelayMs,
  timeoutMs,
  userAgent,
  fetchImpl: fetchImplProp,
  logger,
  sleep: sleepProp,
}: FetchClientOptions): FetchClient {
  const fetchImpl = fetchImplProp ?? globalThis.fetch;
  const sleep = sleepProp ?? defaultSleep;

  const queue: Array<() => void> = [];
  const slotWaiters: Array<() => void> = [];

  let crawlDelayMs = 0;
  let inFlight = 0;
  let hasStartedOnce = false;
  let pumping = false;

  const effectiveDelayMs = (): number => Math.max(requestDelayMs, crawlDelayMs);

  const releaseSlot = () => {
    inFlight--;
    slotWaiters.shift()?.();
  };

  const waitForSlot = (): Promise<void> => {
    return new Promise((resolve) => slotWaiters.push(resolve));
  };

  const pump = async (): Promise<void> => {
    if (pumping) return;
    pumping = true;

    while (queue.length > 0) {
      if (inFlight >= concurrency) {
        await waitForSlot();
        continue;
      }

      const start = queue.shift();
      if (!start) continue;

      if (hasStartedOnce) {
        const delayMs = effectiveDelayMs();
        if (delayMs > 0) await sleep(delayMs);
      }
      hasStartedOnce = true;

      inFlight++;
      start();
    }

    pumping = false;
  };

  function schedule<T>(job: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        job().then(
          (value) => {
            releaseSlot();
            resolve(value);
          },
          (error: unknown) => {
            releaseSlot();
            reject(error instanceof Error ? error : new Error(String(error)));
          },
        );
      });

      void pump();
    });
  }

  async function performOnce(url: string): Promise<HopResult> {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(timeoutMs),
    });

    return {
      status: response.status,
      headers: headersToRecord(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    };
  }

  async function performHopWithRetries(url: string): Promise<HopResult> {
    let attempt = 0;

    while (true) {
      let result: HopResult;
      try {
        result = await schedule(() => performOnce(url));
      } catch (error) {
        if (attempt < MAX_RETRIES) {
          logger?.warn("fetch: network error, retrying", {
            url,
            attempt,
            error: error instanceof Error ? error.message : String(error),
          });
          await sleep(INITIAL_BACKOFF_MS * BACKOFF_MULTIPLIER ** attempt);
          attempt++;
          continue;
        }
        throw new Error(`Network request to ${url} failed after ${MAX_RETRIES + 1} attempts`, { cause: error });
      }

      if (isRetryableStatus(result.status) && attempt < MAX_RETRIES) {
        logger?.warn("fetch: retryable status, retrying", {
          url,
          attempt,
          status: result.status,
        });
        await sleep(INITIAL_BACKOFF_MS * BACKOFF_MULTIPLIER ** attempt);
        attempt++;
        continue;
      }

      return result;
    }
  }

  async function runFetch(url: string): Promise<FetchResponse> {
    const redirectChain: string[] = [];
    let currentUrl = url;

    while (true) {
      const hop = await performHopWithRetries(currentUrl);
      const location = hop.headers["location"];

      if (REDIRECT_STATUSES.has(hop.status) && location !== undefined) {
        if (redirectChain.length >= MAX_REDIRECTS) {
          throw new Error(`Exceeded maximum of ${MAX_REDIRECTS} redirects starting from ${url}`);
        }
        redirectChain.push(currentUrl);
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      return {
        status: hop.status,
        finalUrl: currentUrl,
        redirectChain,
        headers: hop.headers,
        body: hop.body,
      };
    }
  }

  return {
    fetch: runFetch,
    setCrawlDelayMs(ms: number): void {
      crawlDelayMs = ms;
    },
  };
}
