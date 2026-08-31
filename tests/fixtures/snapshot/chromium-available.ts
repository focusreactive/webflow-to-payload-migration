import { existsSync } from "node:fs";

import { chromium } from "playwright";

// True when Playwright's Chromium build is installed. CI runs with
// PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 and no `playwright install` step, so
// real-browser tests must skip there (describe.skipIf(!hasChromium)) rather than
// fail on chromium.launch(). Locally and in live runs the browser is present, so
// these tests execute normally.
export const hasChromium: boolean = (() => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();
