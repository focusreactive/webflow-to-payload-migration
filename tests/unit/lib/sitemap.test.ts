import { parseSitemap } from "#lib/sitemap.ts";

describe("parseSitemap", () => {
  it("parses a urlset with multiple url/loc entries", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/</loc></url>
        <url><loc>https://example.com/about</loc></url>
        <url><loc>https://example.com/blog</loc></url>
      </urlset>`;

    const result = parseSitemap(xml);

    expect(result.kind).toBe("urlset");
    expect(result.entries).toEqual([
      { loc: "https://example.com/", alternates: [] },
      { loc: "https://example.com/about", alternates: [] },
      { loc: "https://example.com/blog", alternates: [] },
    ]);
  });

  it("parses xhtml:link alternates on a url entry", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
              xmlns:xhtml="http://www.w3.org/1999/xhtml">
        <url>
          <loc>https://example.com/</loc>
          <xhtml:link rel="alternate" hreflang="fr" href="https://example.com/fr/"/>
          <xhtml:link rel="alternate" hreflang="en" href="https://example.com/"/>
        </url>
      </urlset>`;

    const result = parseSitemap(xml);

    expect(result.kind).toBe("urlset");
    expect(result.entries).toEqual([
      {
        loc: "https://example.com/",
        alternates: [
          { hreflang: "fr", href: "https://example.com/fr/" },
          { hreflang: "en", href: "https://example.com/" },
        ],
      },
    ]);
  });

  it("skips an xhtml:link alternate missing hreflang or href", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
              xmlns:xhtml="http://www.w3.org/1999/xhtml">
        <url>
          <loc>https://example.com/</loc>
          <xhtml:link rel="alternate" href="https://example.com/no-hreflang/"/>
          <xhtml:link rel="alternate" hreflang="de"/>
          <xhtml:link rel="alternate" hreflang="fr" href="https://example.com/fr/"/>
        </url>
      </urlset>`;

    const result = parseSitemap(xml);

    expect(result.entries).toEqual([
      {
        loc: "https://example.com/",
        alternates: [{ hreflang: "fr", href: "https://example.com/fr/" }],
      },
    ]);
  });

  it("excludes an xhtml:link with hreflang and href but a non-alternate rel", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
              xmlns:xhtml="http://www.w3.org/1999/xhtml">
        <url>
          <loc>https://example.com/</loc>
          <xhtml:link rel="stylesheet" hreflang="fr" href="https://example.com/fr/"/>
        </url>
      </urlset>`;

    const result = parseSitemap(xml);

    expect(result.entries).toEqual([{ loc: "https://example.com/", alternates: [] }]);
  });

  it("parses a sitemapindex with child sitemap locs and no alternates", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sitemap_en.xml</loc></sitemap>
        <sitemap><loc>https://example.com/sitemap_fr.xml</loc></sitemap>
      </sitemapindex>`;

    const result = parseSitemap(xml);

    expect(result.kind).toBe("sitemapindex");
    expect(result.entries).toEqual([
      { loc: "https://example.com/sitemap_en.xml", alternates: [] },
      { loc: "https://example.com/sitemap_fr.xml", alternates: [] },
    ]);
  });

  it("returns kind unknown with no entries for an HTML document", () => {
    const html = "<html><body><p>not a sitemap</p></body></html>";

    const result = parseSitemap(html);

    expect(result.kind).toBe("unknown");
    expect(result.entries).toEqual([]);
  });

  it("returns kind unknown with no entries for garbage input", () => {
    const result = parseSitemap("not xml at all {}");

    expect(result.kind).toBe("unknown");
    expect(result.entries).toEqual([]);
  });

  it("returns kind unknown with no entries for empty input", () => {
    const result = parseSitemap("");

    expect(result.kind).toBe("unknown");
    expect(result.entries).toEqual([]);
  });

  it("trims whitespace around the loc text", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>
          https://example.com/spaced
        </loc></url>
      </urlset>`;

    const result = parseSitemap(xml);

    expect(result.entries).toEqual([{ loc: "https://example.com/spaced", alternates: [] }]);
  });
});
