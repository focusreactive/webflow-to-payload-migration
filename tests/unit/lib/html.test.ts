import { extractAnchorHrefs, loadHtml } from "#lib/html.ts";

describe("extractAnchorHrefs", () => {
  it("extracts hrefs from multiple anchors in document order", () => {
    const html = `
      <html>
        <body>
          <a href="/about">About</a>
          <a href="https://example.com/page?x=1#top">External</a>
          <a href="/blog?page=2">Blog</a>
        </body>
      </html>
    `;

    expect(extractAnchorHrefs(html)).toEqual(["/about", "https://example.com/page?x=1#top", "/blog?page=2"]);
  });

  it("ignores anchors without an href attribute", () => {
    const html = `
      <a name="anchor">No href</a>
      <a href="/contact">Contact</a>
    `;

    expect(extractAnchorHrefs(html)).toEqual(["/contact"]);
  });

  it("returns an empty array for empty html", () => {
    expect(extractAnchorHrefs("")).toEqual([]);
  });
});

describe("loadHtml", () => {
  it("loads html and exposes a root() for traversal", () => {
    const $ = loadHtml('<html data-wf-page="x"><body>hi</body></html>');

    expect($.root().length).toBe(1);
    expect($("html").attr("data-wf-page")).toBe("x");
  });
});
