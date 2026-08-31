import { chromium } from "playwright";

import type { StylesheetProbe } from "../checks.ts";

const PAGE_ROUTE_PREFIX = "/r";

const STYLESHEET_PROBE_SOURCE = `(() => {
  var origin = window.location.origin;
  var strip = function (href) { return href.replace(origin, ""); };
  var isLocal = function (href) { return typeof href === "string" && href.indexOf(origin) === 0; };
  var linked = [];
  var links = document.querySelectorAll("link[rel=stylesheet][href]");
  for (var i = 0; i < links.length; i++) {
    if (isLocal(links[i].href)) linked.push(strip(links[i].href));
  }
  var applied = [];
  for (var j = 0; j < document.styleSheets.length; j++) {
    var sheet = document.styleSheets[j];
    if (!isLocal(sheet.href)) continue;
    var rules = 0;
    try { rules = sheet.cssRules.length; } catch (error) { rules = 0; }
    applied.push({ href: strip(sheet.href), rules: rules });
  }
  return { linked: linked, applied: applied };
})()`;

export async function probeReferenceStylesheets(replayOrigin: string, route: string): Promise<StylesheetProbe> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${replayOrigin}${PAGE_ROUTE_PREFIX}${route}`, { waitUntil: "load" });
    const probe = await page.evaluate<{ linked: string[]; applied: { href: string; rules: number }[] }>(
      STYLESHEET_PROBE_SOURCE,
    );
    return { route, ...probe };
  } finally {
    await browser.close();
  }
}
