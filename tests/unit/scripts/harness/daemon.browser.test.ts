import { join } from "node:path";

import { chromium } from "playwright";

import { hasChromium } from "../../../fixtures/snapshot/chromium-available.ts";
import { startHarness } from "#harness/index.ts";

const PROJECT = join(import.meta.dirname, "../../../fixtures/harness-project");
const ENTRY = ".migration/artifacts/synth/blocks/demo/Component.tsx";
const INPUT = join(PROJECT, ".migration/artifacts/synth/blocks/demo/input.json");
const ENTRY_TWO = ".migration/artifacts/synth/blocks/demo-two/Component.tsx";
const INPUT_TWO = join(PROJECT, ".migration/artifacts/synth/blocks/demo-two/input.json");

const DEMO_HEIGHT = 200;
const DEMO_TWO_HEIGHT = 120;

// The candidate's own height, read straight off the DOM. The private tool went
// through a `__mig` page library for this; the public tool ships no page library,
// so the test measures the rendered root element itself.
function candidateHeight(): number {
  const node = document.getElementById("root")?.firstElementChild;
  if (node === null || node === undefined) throw new Error("no rendered candidate under #root");
  return node.getBoundingClientRect().height;
}

describe.skipIf(!hasChromium)("harness daemon", () => {
  it("renders a candidate into the page", async () => {
    const harness = await startHarness(PROJECT);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(harness.renderUrl({ kind: "block", entry: ENTRY, inputPath: INPUT }), { waitUntil: "load" });
      await page.waitForSelector("body[data-render-ready='true']");
      expect(await page.evaluate(candidateHeight)).toBe(DEMO_HEIGHT);
    } finally {
      await browser.close();
      await harness.close();
    }
  });

  it("serves two different entities from one server", async () => {
    const harness = await startHarness(PROJECT);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();

      await page.goto(harness.renderUrl({ kind: "block", entry: ENTRY, inputPath: INPUT }), { waitUntil: "load" });
      await page.waitForSelector("body[data-render-ready='true']");
      expect(await page.evaluate(candidateHeight)).toBe(DEMO_HEIGHT);

      await page.goto(harness.renderUrl({ kind: "block", entry: ENTRY_TWO, inputPath: INPUT_TWO }), {
        waitUntil: "load",
      });
      await page.waitForSelector("body[data-render-ready='true']");
      expect(await page.getAttribute("body", "data-render-error")).toBeNull();
      expect(await page.evaluate(candidateHeight)).toBe(DEMO_TWO_HEIGHT);
    } finally {
      await browser.close();
      await harness.close();
    }
  });

  it("answers /_health with a real json probe, not the SPA fallback", async () => {
    const harness = await startHarness(PROJECT);
    try {
      const response = await fetch(`${harness.origin}/_health`);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toEqual({ ok: true });
    } finally {
      await harness.close();
    }
  });
});
