import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { rewriteHtml } from "#replay/rewrite.ts";

const SOURCE = `<!doctype html><html><head></head><body><div><span>a</span><span>b</span></div></body></html>`;

function render(anchors: Record<string, number[]>): JSDOM {
  const html = rewriteHtml({
    html: SOURCE,
    baseUrl: "https://example.test/",
    idFor: () => undefined,
    fontsCss: "",
    anchors: JSON.stringify(anchors),
  });

  return new JSDOM(html, { runScripts: "dangerously" });
}

describe("replay anchor stamping", () => {
  it("stamps every mapped node once the page has loaded", async () => {
    const dom = render({ "mig-0": [0], "mig-2": [0, 1] });
    await new Promise((resolve) => {
      dom.window.addEventListener("load", () => setTimeout(resolve, 0));
    });

    const doc = dom.window.document;
    expect(doc.querySelector("div")?.getAttribute("data-mig-id")).toBe("mig-0");
    expect(doc.querySelectorAll("span")[1]?.getAttribute("data-mig-id")).toBe("mig-2");
    expect((dom.window as unknown as { __migStamped: { stamped: number } }).__migStamped.stamped).toBe(2);
  });

  it("reports ids whose path no longer resolves instead of throwing", async () => {
    const dom = render({ "mig-9": [7, 7, 7] });
    await new Promise((resolve) => {
      dom.window.addEventListener("load", () => setTimeout(resolve, 0));
    });

    const stamped = (dom.window as unknown as { __migStamped: { missing: string[] } }).__migStamped;
    expect(stamped.missing).toEqual(["mig-9"]);
  });
});
