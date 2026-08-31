import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { chromium } from "playwright";

import { hasChromium } from "../../../fixtures/snapshot/chromium-available.ts";
import { startHarness } from "#harness/index.ts";

const PROJECT = join(import.meta.dirname, "../../../fixtures/harness-project");
const DEMO_ENTRY = ".migration/artifacts/synth/blocks/demo/Component.tsx";
const DEMO_INPUT = join(PROJECT, ".migration/artifacts/synth/blocks/demo/input.json");

const LATE = ".migration/artifacts/synth/blocks/late";
const LATE_DIR = join(PROJECT, LATE);
const LATE_ENTRY = `${LATE}/Component.tsx`;
const LATE_INPUT = join(LATE_DIR, "input.json");
const LATE_PADDING = "17px";

describe.skipIf(!hasChromium)("harness tailwind sources", () => {
  afterEach(async () => {
    await rm(LATE_DIR, { recursive: true, force: true });
  });

  it("compiles utilities from a component written after the server started", async () => {
    const harness = await startHarness(PROJECT);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const render = async (entry: string, inputPath: string): Promise<void> => {
        await page.goto(harness.renderUrl({ kind: "block", entry, inputPath }), { waitUntil: "load" });
        await page.waitForSelector("body[data-render-ready='true']");
        expect(await page.getAttribute("body", "data-render-error")).toBeNull();
      };

      // The stylesheet is built from the entities that exist at this point — the
      // state every author's first entity is authored against.
      await render(DEMO_ENTRY, DEMO_INPUT);

      await mkdir(LATE_DIR, { recursive: true });
      await writeFile(LATE_INPUT, "{}\n");
      await writeFile(
        join(LATE_DIR, "Component.tsx"),
        `export default function Late() {\n  return <section className="pt-[${LATE_PADDING}]" />;\n}\n`,
      );

      await render(LATE_ENTRY, LATE_INPUT);
      const paddingTop = await page.evaluate(() => {
        const section = document.querySelector("section");
        return section === null ? null : getComputedStyle(section).paddingTop;
      });
      expect(paddingTop).toBe(LATE_PADDING);
    } finally {
      await browser.close();
      await harness.close();
    }
  });
});
