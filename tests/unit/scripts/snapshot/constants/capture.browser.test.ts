import { hasChromium } from "../../../../fixtures/snapshot/chromium-available.ts";

import { HIDDEN_ATTRIBUTE, HIDDEN_STYLE_CSS } from "#snapshot/constants/capture.ts";
import { launchBrowser } from "#lib/browser.ts";

// Third-party consent widgets ship `visibility: visible` on their own inner
// nodes, which beats the inherited value from a hidden ancestor.
const WIDGET_HTML = `<!doctype html><html><head><style>
  body { margin: 0; }
  #banner { position: fixed; bottom: 0; height: 70px; width: 100%; background: red; }
  #banner .row, #banner .text { visibility: visible; }
</style></head><body>
  <div id="banner" data-mig-id="mig-banner">
    <div class="row"><div class="text">Accept all cookies</div></div>
  </div>
</body></html>`;

describe.skipIf(!hasChromium)("HIDDEN_STYLE_CSS", () => {
  it("hides a subtree whose descendants force visibility: visible", async () => {
    const browser = await launchBrowser();
    try {
      const context = await browser.newContext({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.setContent(WIDGET_HTML);

      const before = await page.evaluate(
        () => getComputedStyle(document.querySelector("#banner .text") as Element).visibility,
      );
      expect(before).toBe("visible");

      await page.addStyleTag({ content: HIDDEN_STYLE_CSS });
      await page.evaluate(
        (attribute: string) => document.querySelector("#banner")?.setAttribute(attribute, "1"),
        HIDDEN_ATTRIBUTE,
      );

      const after = await page.evaluate(() => {
        const root = document.querySelector("#banner") as Element;
        const descendants = Array.from(root.querySelectorAll("*"));
        return {
          root: getComputedStyle(root).visibility,
          visibleDescendants: descendants.filter((el) => getComputedStyle(el).visibility === "visible").length,
        };
      });

      expect(after.root).toBe("hidden");
      expect(after.visibleDescendants).toBe(0);
      await context.close();
    } finally {
      await browser.close();
    }
  });

  it("keeps the hidden element in flow so sibling layout does not shift", async () => {
    const browser = await launchBrowser();
    try {
      const context = await browser.newContext({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.setContent(
        `<!doctype html><html><head><style>body { margin: 0; }
         .box { height: 50px; }</style></head><body>
           <div class="box" data-mig-id="mig-a"></div>
           <div class="box" id="after"></div>
         </body></html>`,
      );

      const topBefore = await page.evaluate(
        () => (document.querySelector("#after") as Element).getBoundingClientRect().top,
      );
      await page.addStyleTag({ content: HIDDEN_STYLE_CSS });
      await page.evaluate(
        (attribute: string) => document.querySelector('[data-mig-id="mig-a"]')?.setAttribute(attribute, "1"),
        HIDDEN_ATTRIBUTE,
      );
      const topAfter = await page.evaluate(
        () => (document.querySelector("#after") as Element).getBoundingClientRect().top,
      );

      expect(topAfter).toBe(topBefore);
      await context.close();
    } finally {
      await browser.close();
    }
  });
});
