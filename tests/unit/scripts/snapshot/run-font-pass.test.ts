import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FetchClient, FetchResponse } from "#lib/fetch/create-fetch-client/types.ts";
import { createLogger } from "#lib/logger.ts";
import { openSnapshotStore } from "#lib/snapshot-store/index.ts";
import { SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";
import { runFontPass } from "#snapshot/run-font-pass.ts";

function fakeClient(bodies: Record<string, string | Buffer>): FetchClient {
  return {
    fetch(url: string): Promise<FetchResponse> {
      const body = bodies[url];
      if (body === undefined) throw new Error(`unexpected fetch: ${url}`);
      return Promise.resolve({ status: 200, finalUrl: url, redirectChain: [], headers: {}, body: Buffer.from(body) });
    },
    setCrawlDelayMs() {},
  };
}

describe("runFontPass", () => {
  it("downloads declared faces and emits fonts.css pointing at the mirror", async () => {
    const project = await mkdtemp(join(tmpdir(), "fonts-"));
    try {
      const store = await openSnapshotStore(
        project,
        fakeClient({ "https://fonts.gstatic.com/s/inter/inter-400.woff2": Buffer.from("font-bytes") }),
      );
      const providerCss = `@font-face { font-family: "Inter"; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/inter/inter-400.woff2) format("woff2"); }`;
      const html = `<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inter:400"></head><body></body></html>`;

      const result = await runFontPass({
        projectPath: project,
        store,
        pages: [{ url: "https://example.com/", html }],
        fetchCss: () => Promise.resolve(providerCss),
        logger: createLogger({ level: "error" }),
      });

      expect(result.downloaded).toBe(1);
      expect(existsSync(join(project, SNAPSHOT_DIR, "assets", "fonts", "inter-400.woff2"))).toBe(true);
      const css = await readFile(join(project, SNAPSHOT_DIR, "styles", "fonts.css"), "utf8");
      expect(css).toContain('font-family: "Inter"');
      expect(css).toContain('url("../assets/fonts/inter-400.woff2")');
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  });
});
