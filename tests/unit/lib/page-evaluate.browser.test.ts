import { hasChromium } from "../../fixtures/snapshot/chromium-available.ts";

import { installEvaluateShim } from "#lib/page-evaluate.ts";
import { launchBrowser } from "#lib/browser.ts";

function withInnerNamedFunction(args: { value: number }): number {
  const double = (input: number): number => input * 2;
  return double(args.value);
}

function shimType(): string {
  return typeof (globalThis as { __name?: unknown }).__name;
}

describe.skipIf(!hasChromium)("installEvaluateShim", () => {
  it("defines the bundler helper in the page and keeps it across a reload", async () => {
    const browser = await launchBrowser();
    try {
      const context = await browser.newContext();
      await installEvaluateShim(context);
      const page = await context.newPage();
      await page.setContent("<body></body>");
      expect(await page.evaluate(shimType)).toBe("function");
      expect(await page.evaluate(withInnerNamedFunction, { value: 21 })).toBe(42);
      await page.reload();
      expect(await page.evaluate(shimType)).toBe("function");
      await context.close();
    } finally {
      await browser.close();
    }
  });
});
