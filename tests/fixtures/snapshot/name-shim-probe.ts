// Probe script for the __name-shim regression test. Run via `tsx` in a
// subprocess so esbuild's keepNames rewrites the inner named arrows inside the
// functions createPlaywrightDriver passes to page.evaluate() as `__name(...)` —
// the exact condition that crashes the real tool but which vitest's own
// transform does NOT reproduce. Renders a trivial page and prints a sentinel.
//
// Outcomes the test distinguishes via stdout/stderr:
//   - "PROBE_OK"                  -> the shim is present and working
//   - "__name is not defined"     -> regression: the shim was removed
//   - a browser-launch error      -> no Chromium here (CI); the test skips
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createPlaywrightDriver } from "#snapshot/create-playwright-driver.ts";

async function main(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "name-shim-probe-"));
  await writeFile(
    join(dir, "page.html"),
    "<!doctype html><html><head><meta charset='utf-8'></head><body><div style='height:1200px;background:#eee'>probe</div></body></html>",
  );

  const driver = createPlaywrightDriver();
  try {
    const rendered = await driver.render({
      url: pathToFileURL(join(dir, "page.html")).href,
      viewports: { desktop: { width: 800, height: 600, deviceScaleFactor: 1 } },
      settleMs: 10,
      stabilize: { freezeMotion: true, neutralizeSticky: true, preScrollRemeasure: true },
    });
    if (!rendered.stitches.desktop) {
      throw new Error("probe produced no desktop stitch");
    }
    console.log("PROBE_OK");
  } finally {
    await driver.close();
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
