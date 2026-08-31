import { normalizeUrl, routeFromUrl } from "#lib/url.ts";

describe("normalizeUrl", () => {
  it("lowercases the host but preserves path casing", () => {
    expect(normalizeUrl("HTTPS://WWW.Site.COM/About/")).toBe("https://www.site.com/About");
  });

  it("strips the fragment", () => {
    expect(normalizeUrl("https://example.com/page#section")).toBe("https://example.com/page");
  });

  it("strips the default port for https", () => {
    expect(normalizeUrl("https://example.com:443/page")).toBe("https://example.com/page");
  });

  it("strips the default port for http", () => {
    expect(normalizeUrl("http://example.com:80/page")).toBe("http://example.com/page");
  });

  it("keeps a non-standard port", () => {
    expect(normalizeUrl("http://example.com:8080/page")).toBe("http://example.com:8080/page");
  });

  it("strips a trailing slash from a non-root path", () => {
    expect(normalizeUrl("https://example.com/about/")).toBe("https://example.com/about");
  });

  it("keeps the root path as a single slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("preserves the query string byte-for-byte", () => {
    expect(normalizeUrl("https://example.com/blog?abc123_page=2")).toBe("https://example.com/blog?abc123_page=2");
  });

  it("is idempotent", () => {
    const once = normalizeUrl("HTTPS://WWW.Site.COM/About/?x=1#f");

    expect(normalizeUrl(once)).toBe(once);
  });

  it("throws on an invalid URL", () => {
    expect(() => normalizeUrl("not a url")).toThrow(TypeError);
  });
});

describe("routeFromUrl", () => {
  it("returns only the path, dropping query and fragment", () => {
    expect(routeFromUrl("https://a.com/about/?x=1#f")).toBe("/about");
  });

  it("returns the root path as a single slash", () => {
    expect(routeFromUrl("https://a.com/")).toBe("/");
  });
});
