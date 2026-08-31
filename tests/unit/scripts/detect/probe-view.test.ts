import type { ProbeData } from "#probe/read-probe-data.ts";
import { buildProbeView, PROBE_VIEW_PREFIX_BYTES } from "#detect/probe-view.ts";

function probeData(overrides: Partial<ProbeData> = {}): ProbeData {
  return {
    sourceUrl: "https://example.com/",
    homeHtml: "<html><head></head><body></body></html>",
    homeHttp: {
      status: 200,
      finalUrl: "https://example.com/",
      redirectChain: [],
      headers: {},
    },
    ...overrides,
  };
}

describe("buildProbeView", () => {
  describe("htmlTag", () => {
    it("extracts the opening <html> tag including its attributes", () => {
      const view = buildProbeView(
        probeData({
          homeHtml: '<html lang="en" data-wf-page="123"><head></head><body></body></html>',
        }),
      );

      expect(view.htmlTag).toBe('<html lang="en" data-wf-page="123">');
    });

    it("is case-insensitive", () => {
      const view = buildProbeView(probeData({ homeHtml: '<HTML LANG="en"></HTML>' }));

      expect(view.htmlTag).toBe('<HTML LANG="en">');
    });

    it("is empty when there is no <html> tag", () => {
      const view = buildProbeView(probeData({ homeHtml: "<body>hi</body>" }));

      expect(view.htmlTag).toBe("");
    });
  });

  describe("head", () => {
    it("extracts the inner content between <head> and </head>", () => {
      const view = buildProbeView(
        probeData({
          homeHtml: '<html><head><title>hi</title><meta charset="utf-8"></head><body></body></html>',
        }),
      );

      expect(view.head).toBe('<title>hi</title><meta charset="utf-8">');
    });

    it("is case-insensitive and tolerant of attributes on <head>", () => {
      const view = buildProbeView(probeData({ homeHtml: '<html><Head data-x="1">stuff</Head></html>' }));

      expect(view.head).toBe("stuff");
    });

    it("crosses newlines", () => {
      const view = buildProbeView(
        probeData({
          homeHtml: "<html><head>\n<title>hi</title>\n</head></html>",
        }),
      );

      expect(view.head).toBe("\n<title>hi</title>\n");
    });

    it("is empty when there is no <head> tag", () => {
      const view = buildProbeView(probeData({ homeHtml: "<html><body></body></html>" }));

      expect(view.head).toBe("");
    });
  });

  describe("body", () => {
    it("extracts the inner content between <body> and </body>, without the wrapper tags", () => {
      const view = buildProbeView(
        probeData({
          homeHtml: '<html><body class="wf-body"><div>content</div></body></html>',
        }),
      );

      expect(view.body).toBe("<div>content</div>");
    });

    it("falls back to fullHtml when there is no <body> tag", () => {
      const homeHtml = "<html><head><title>no body here</title></head></html>";
      const view = buildProbeView(probeData({ homeHtml }));

      expect(view.body).toBe(view.fullHtml);
      expect(view.body).toBe(homeHtml);
    });
  });

  describe("prefix", () => {
    it("is truncated to PROBE_VIEW_PREFIX_BYTES for long documents", () => {
      const longHtml = `<html>${"a".repeat(PROBE_VIEW_PREFIX_BYTES * 2)}</html>`;
      const view = buildProbeView(probeData({ homeHtml: longHtml }));

      expect(view.prefix).toHaveLength(PROBE_VIEW_PREFIX_BYTES);
      expect(view.prefix).toBe(longHtml.slice(0, PROBE_VIEW_PREFIX_BYTES));
    });

    it("is the whole document when shorter than PROBE_VIEW_PREFIX_BYTES", () => {
      const homeHtml = "<!doctype html><html></html>";
      const view = buildProbeView(probeData({ homeHtml }));

      expect(view.prefix).toBe(homeHtml);
    });
  });

  describe("passthrough fields", () => {
    it("preserves already-lowercase headers as-is", () => {
      const headers = { "content-type": "text/html", server: "some-edge/1.0" };
      const view = buildProbeView(probeData({ homeHttp: { ...probeData().homeHttp, headers } }));

      expect(view.headers).toEqual(headers);
    });

    it("copies finalUrl, redirectChain, and sourceUrl from the probe data", () => {
      const view = buildProbeView(
        probeData({
          sourceUrl: "https://example.com/",
          homeHttp: {
            status: 301,
            finalUrl: "https://example.com/landed",
            redirectChain: ["https://example.com/"],
            headers: {},
          },
        }),
      );

      expect(view.finalUrl).toBe("https://example.com/landed");
      expect(view.redirectChain).toEqual(["https://example.com/"]);
      expect(view.sourceUrl).toBe("https://example.com/");
    });

    it("passes fullHtml through as data.homeHtml", () => {
      const view = buildProbeView(probeData({ homeHtml: "<html>x</html>" }));

      expect(view.fullHtml).toBe("<html>x</html>");
    });

    it("carries robotsTxt, sitemapXml, and notFound through when present", () => {
      const view = buildProbeView(
        probeData({
          robotsTxt: "User-agent: *\n",
          sitemapXml: "<urlset></urlset>",
          notFound: { html: "nope", status: 404 },
        }),
      );

      expect(view.robotsTxt).toBe("User-agent: *\n");
      expect(view.sitemapXml).toBe("<urlset></urlset>");
      expect(view.notFound).toEqual({ html: "nope", status: 404 });
    });

    it("omits robotsTxt, sitemapXml, and notFound when absent", () => {
      const view = buildProbeView(probeData());

      expect(view.robotsTxt).toBeUndefined();
      expect(view.sitemapXml).toBeUndefined();
      expect(view.notFound).toBeUndefined();
    });
  });
});
