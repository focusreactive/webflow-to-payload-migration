import { createFetchClient } from "#lib/fetch/create-fetch-client/index.ts";
import { MAX_RETRIES } from "#lib/fetch/create-fetch-client/constants.ts";
import type { FetchClientOptions } from "#lib/fetch/create-fetch-client/types.ts";

/** Minimal fetch-shaped test double: avoids real Response body-stream
 * machinery so assertions never depend on hidden macrotasks. */
function fakeResponse(status: number, opts?: { headers?: Record<string, string> }): Response {
  return {
    status,
    headers: new Headers(opts?.headers ?? {}),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as unknown as Response;
}

/** Spins on microtasks (never real timers) until `predicate` is true or the
 * tick budget runs out, so async internals (queue pump, retries) can settle. */
async function waitUntil(predicate: () => boolean, maxTicks = 200): Promise<void> {
  for (let i = 0; i < maxTicks && !predicate(); i++) {
    await Promise.resolve();
  }
}

function baseOptions(overrides: Partial<FetchClientOptions> = {}): FetchClientOptions {
  return {
    concurrency: 1,
    requestDelayMs: 0,
    timeoutMs: 1000,
    userAgent: "test-agent/1.0",
    sleep: () => Promise.resolve(),
    ...overrides,
  };
}

describe("createFetchClient", () => {
  it("sends the configured User-Agent header on a successful GET", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(fakeResponse(200)));
    const client = createFetchClient(baseOptions({ fetchImpl: fetchImpl as unknown as typeof fetch }));

    const result = await client.fetch("https://example.com/");

    expect(result.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = (fetchImpl.mock.calls[0] ?? []) as unknown as [string, RequestInit?];
    expect(init).toMatchObject({
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "test-agent/1.0" },
    });
  });

  it("returns a 404 immediately without retrying", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(fakeResponse(404)));
    const sleep = vi.fn(() => Promise.resolve());
    const client = createFetchClient(baseOptions({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep }));

    const result = await client.fetch("https://example.com/missing");

    expect(result.status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("treats a 3xx response without a Location header as final, not a redirect hop", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(fakeResponse(304)));
    const client = createFetchClient(baseOptions({ fetchImpl: fetchImpl as unknown as typeof fetch }));

    const result = await client.fetch("https://example.com/cached");

    expect(result.status).toBe(304);
    expect(result.redirectChain).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries 429 responses with growing exponential backoff before succeeding", async () => {
    const fetchImpl = vi.fn<() => Promise<Response>>();
    fetchImpl
      .mockResolvedValueOnce(fakeResponse(429))
      .mockResolvedValueOnce(fakeResponse(429))
      .mockResolvedValueOnce(fakeResponse(200));
    const sleepCalls: number[] = [];
    const sleep = vi.fn((ms: number) => {
      sleepCalls.push(ms);
      return Promise.resolve();
    });
    const client = createFetchClient(baseOptions({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep }));

    const result = await client.fetch("https://example.com/");

    expect(result.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleepCalls).toEqual([500, 1000]);
  });

  it("returns the last 5xx response after exhausting retries", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(fakeResponse(500)));
    const sleep = vi.fn(() => Promise.resolve());
    const client = createFetchClient(baseOptions({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep }));

    const result = await client.fetch("https://example.com/");

    expect(result.status).toBe(500);
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_RETRIES + 1);
    expect(sleep).toHaveBeenCalledTimes(MAX_RETRIES);
  });

  it("throws with the original error as cause after exhausting retries on network errors", async () => {
    const networkError = new Error("ECONNRESET");
    const fetchImpl = vi.fn(() => Promise.reject(networkError));
    const sleep = vi.fn(() => Promise.resolve());
    const client = createFetchClient(baseOptions({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep }));

    await expect(client.fetch("https://example.com/")).rejects.toMatchObject({
      cause: networkError,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_RETRIES + 1);
  });

  it("follows a redirect chain, resolving each Location against its own hop URL", async () => {
    // hop2's relative Location ("page3") must resolve against hop2's own URL
    // (.../dir2/page2 -> .../dir2/page3), not against the original request
    // URL (.../dir1/page1) -- that would wrongly yield .../dir1/page3.
    const fetchImpl = vi.fn<() => Promise<Response>>();
    fetchImpl
      .mockResolvedValueOnce(fakeResponse(301, { headers: { Location: "/dir2/page2" } }))
      .mockResolvedValueOnce(fakeResponse(302, { headers: { Location: "page3" } }))
      .mockResolvedValueOnce(fakeResponse(200));
    const client = createFetchClient(baseOptions({ fetchImpl: fetchImpl as unknown as typeof fetch }));

    const result = await client.fetch("https://example.com/dir1/page1");

    expect(result.redirectChain).toEqual(["https://example.com/dir1/page1", "https://example.com/dir2/page2"]);
    expect(result.finalUrl).toBe("https://example.com/dir2/page3");
    expect(result.status).toBe(200);
  });

  it("throws when following redirects would exceed MAX_REDIRECTS", async () => {
    const fetchImpl = vi.fn((input: string | URL) => {
      const next = String(input).endsWith("/a") ? "/b" : "/a";
      return Promise.resolve(fakeResponse(302, { headers: { Location: next } }));
    });
    const client = createFetchClient(baseOptions({ fetchImpl: fetchImpl as unknown as typeof fetch }));

    await expect(client.fetch("https://example.com/a")).rejects.toThrow();
  });

  it("keeps at most `concurrency` requests in flight at once", async () => {
    const pendingResolvers: Array<() => void> = [];
    let active = 0;
    let maxActive = 0;
    const fetchImpl = vi.fn(() => {
      active++;
      maxActive = Math.max(maxActive, active);
      return new Promise<Response>((resolve) => {
        pendingResolvers.push(() => {
          active--;
          resolve(fakeResponse(200));
        });
      });
    });
    const client = createFetchClient(
      baseOptions({
        concurrency: 2,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    );

    const urls = ["1", "2", "3", "4", "5"].map((n) => `https://example.com/${n}`);
    const results = Promise.all(urls.map((url) => client.fetch(url)));

    await waitUntil(() => fetchImpl.mock.calls.length === 2);
    expect(active).toBe(2);

    for (const expectedCalls of [3, 4, 5]) {
      const resolveNext = pendingResolvers.shift();
      expect(resolveNext).toBeDefined();
      resolveNext?.();
      await waitUntil(() => fetchImpl.mock.calls.length === expectedCalls);
      expect(active).toBeLessThanOrEqual(2);
    }

    for (const resolve of pendingResolvers.splice(0)) resolve();
    await results;

    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(maxActive).toBe(2);
  });

  it("waits the effective delay between starts and honors setCrawlDelayMs", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(fakeResponse(200)));
    const sleepCalls: number[] = [];
    const sleep = vi.fn((ms: number) => {
      sleepCalls.push(ms);
      return Promise.resolve();
    });
    const client = createFetchClient(
      baseOptions({
        requestDelayMs: 250,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep,
      }),
    );

    await client.fetch("https://example.com/1");
    await client.fetch("https://example.com/2");
    expect(sleepCalls).toEqual([250]);

    client.setCrawlDelayMs(500);
    await client.fetch("https://example.com/3");
    expect(sleepCalls).toEqual([250, 500]);
  });
});
