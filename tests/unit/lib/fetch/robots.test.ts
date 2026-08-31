import { parseRobots } from "#lib/fetch/robots.ts";

describe("parseRobots", () => {
  it("converts an integer Crawl-delay from seconds to milliseconds", () => {
    expect(parseRobots("User-agent: *\nCrawl-delay: 2\n")).toEqual({
      crawlDelayMs: 2000,
      sitemapUrls: [],
    });
  });

  it("converts a fractional Crawl-delay from seconds to milliseconds", () => {
    expect(parseRobots("User-agent: *\nCrawl-delay: 0.5\n")).toEqual({
      crawlDelayMs: 500,
      sitemapUrls: [],
    });
  });

  it("takes the max Crawl-delay across multiple User-agent blocks", () => {
    const content = [
      "User-agent: a",
      "Crawl-delay: 1",
      "",
      "User-agent: b",
      "Crawl-delay: 5",
      "",
      "User-agent: c",
      "Crawl-delay: 2",
    ].join("\n");

    expect(parseRobots(content).crawlDelayMs).toBe(5000);
  });

  it("omits crawlDelayMs when no Crawl-delay directive is present", () => {
    const result = parseRobots("User-agent: *\nDisallow: /admin\n");

    expect(result).toEqual({ sitemapUrls: [] });
    expect(result).not.toHaveProperty("crawlDelayMs");
  });

  it("collects a Sitemap directive case-insensitively and trims surrounding spaces", () => {
    expect(parseRobots("  SiTeMaP:   https://a.com/sitemap.xml  \n")).toEqual({
      sitemapUrls: ["https://a.com/sitemap.xml"],
    });
  });

  it("collects multiple Sitemap directives in order of appearance", () => {
    const content = [
      "Sitemap: https://a.com/sitemap-1.xml",
      "User-agent: *",
      "Disallow: /",
      "Sitemap: https://a.com/sitemap-2.xml",
    ].join("\n");

    expect(parseRobots(content).sitemapUrls).toEqual(["https://a.com/sitemap-1.xml", "https://a.com/sitemap-2.xml"]);
  });

  it("returns an empty sitemapUrls list for an empty file", () => {
    expect(parseRobots("")).toEqual({ sitemapUrls: [] });
  });

  it("returns an empty sitemapUrls list for a garbage file", () => {
    expect(parseRobots("<html>not a robots file</html>")).toEqual({
      sitemapUrls: [],
    });
  });

  it("ignores a non-numeric Crawl-delay value", () => {
    const result = parseRobots("Crawl-delay: soon\n");

    expect(result).toEqual({ sitemapUrls: [] });
  });

  it("ignores text after a # comment marker on a directive line", () => {
    expect(parseRobots("Crawl-delay: 2 # be polite\n").crawlDelayMs).toBe(2000);
  });
});
