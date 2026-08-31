import type { StyleEntry } from "#snapshot/types.ts";
import { classifyDepUrl, extractStaticDeps, serializeStyles, unionDeps } from "#snapshot/utils/snapshot-site.ts";

describe("classifyDepUrl", () => {
  it("classifies .css as style", () => {
    expect(classifyDepUrl("https://cdn.example.com/site.css")).toBe("style");
  });

  it("classifies .js as script", () => {
    expect(classifyDepUrl("https://cdn.example.com/app.js")).toBe("script");
  });

  it("classifies .mjs as script", () => {
    expect(classifyDepUrl("https://cdn.example.com/chunk.mjs")).toBe("script");
  });

  it("classifies .json as data", () => {
    expect(classifyDepUrl("https://cdn.example.com/search-index.json")).toBe("data");
  });

  it("returns undefined for .png (media, handled by M4)", () => {
    expect(classifyDepUrl("https://cdn.example.com/hero.png")).toBeUndefined();
  });

  it("returns undefined for .woff2 (media, handled by M4)", () => {
    expect(classifyDepUrl("https://cdn.example.com/font.woff2")).toBeUndefined();
  });

  it("returns undefined when there is no extension", () => {
    expect(classifyDepUrl("https://cdn.example.com/about")).toBeUndefined();
  });

  it("is not affected by a query string", () => {
    expect(classifyDepUrl("https://cdn.example.com/a.css?v=1")).toBe("style");
  });

  it("is not affected by a fragment", () => {
    expect(classifyDepUrl("https://cdn.example.com/a.js#top")).toBe("script");
  });

  it("lowercases the extension before matching", () => {
    expect(classifyDepUrl("https://cdn.example.com/a.CSS")).toBe("style");
  });

  it("handles a relative path that new URL cannot parse on its own", () => {
    expect(classifyDepUrl("/static/app.js?v=2")).toBe("script");
  });

  it("returns undefined for a relative path with no extension", () => {
    expect(classifyDepUrl("/about?x=1")).toBeUndefined();
  });
});

describe("extractStaticDeps", () => {
  it("extracts a stylesheet link href resolved against baseUrl", () => {
    const html = '<html><head><link rel="stylesheet" href="/css/site.css"></head></html>';

    expect(extractStaticDeps(html, "https://example.com/page")).toEqual(["https://example.com/css/site.css"]);
  });

  it("extracts modulepreload and preload link hrefs", () => {
    const html = `
      <html><head>
        <link rel="modulepreload" href="/js/chunk.mjs">
        <link rel="preload" href="/fonts/font.woff2">
      </head></html>
    `;

    expect(extractStaticDeps(html, "https://example.com/")).toEqual([
      "https://example.com/js/chunk.mjs",
      "https://example.com/fonts/font.woff2",
    ]);
  });

  it("extracts a script src resolved against baseUrl", () => {
    const html = '<html><body><script src="/js/app.js"></script></body></html>';

    expect(extractStaticDeps(html, "https://example.com/")).toEqual(["https://example.com/js/app.js"]);
  });

  it("resolves an already-absolute CDN URL as-is", () => {
    const html = '<link rel="stylesheet" href="https://cdn.other.com/lib.css">';

    expect(extractStaticDeps(html, "https://example.com/")).toEqual(["https://cdn.other.com/lib.css"]);
  });

  it("ignores <a href> anchors entirely", () => {
    const html = '<a href="/about">About</a>';

    expect(extractStaticDeps(html, "https://example.com/")).toEqual([]);
  });

  it("ignores link rel values other than stylesheet, modulepreload, preload", () => {
    const html = '<link rel="icon" href="/favicon.ico">';

    expect(extractStaticDeps(html, "https://example.com/")).toEqual([]);
  });

  it("skips a script with no src", () => {
    const html = "<script>console.log(1)</script>";

    expect(extractStaticDeps(html, "https://example.com/")).toEqual([]);
  });
});

describe("unionDeps", () => {
  it("merges static and network urls", () => {
    expect(unionDeps(["https://example.com/a.css"], ["https://example.com/b.js"])).toEqual([
      "https://example.com/a.css",
      "https://example.com/b.js",
    ]);
  });

  it("drops media urls that classifyDepUrl does not recognize", () => {
    expect(
      unionDeps(["https://example.com/a.css", "https://example.com/hero.png"], ["https://example.com/font.woff2"]),
    ).toEqual(["https://example.com/a.css"]);
  });

  it("dedupes a non-normalized duplicate (host case variant), keeping the first form", () => {
    expect(unionDeps(["https://EXAMPLE.com/a.css"], ["https://example.com/a.css"])).toEqual([
      "https://EXAMPLE.com/a.css",
    ]);
  });

  it("dedupes a trailing-slash-normalized duplicate", () => {
    expect(unionDeps(["https://example.com/dir/a.json"], ["https://example.com/dir/a.json#frag"])).toEqual([
      "https://example.com/dir/a.json",
    ]);
  });

  it("returns a deterministic sorted order regardless of input order", () => {
    const urls = unionDeps(["https://example.com/z.css", "https://example.com/a.js"], []);

    expect(urls).toEqual(["https://example.com/a.js", "https://example.com/z.css"]);
  });
});

describe("serializeStyles", () => {
  function fakeStyles(): Record<string, StyleEntry> {
    return {
      "mig-2": {
        props: { color: "red", display: "flex" },
        rects: {
          mobile: { x: 0, y: 0, width: 100, height: 50 },
          desktop: { x: 0, y: 0, width: 400, height: 50 },
        },
      },
      "mig-1": {
        props: { display: "block", color: "blue" },
        rects: {
          desktop: { x: 10, y: 5, width: 200, height: 30 },
        },
      },
    };
  }

  it("puts the curated props directly under the mig-id and drops the rects", () => {
    const parsed: unknown = JSON.parse(serializeStyles(fakeStyles()));

    expect(parsed).toEqual({
      "mig-1": { color: "blue", display: "block" },
      "mig-2": { color: "red", display: "flex" },
    });
  });

  it("is deterministic regardless of input key order", () => {
    const input = fakeStyles();

    // Same data, but every key (mig-id, prop) inserted in reverse order.
    const shuffled: Record<string, StyleEntry> = {};
    for (const migId of Object.keys(input).reverse()) {
      const entry = input[migId];
      if (!entry) continue;

      const props: Record<string, string> = {};
      for (const key of Object.keys(entry.props).reverse()) {
        props[key] = entry.props[key] as string;
      }

      shuffled[migId] = { props, rects: entry.rects };
    }

    expect(serializeStyles(shuffled)).toBe(serializeStyles(input));
  });

  it("ends with a trailing newline", () => {
    expect(serializeStyles(fakeStyles()).endsWith("\n")).toBe(true);
  });
});
