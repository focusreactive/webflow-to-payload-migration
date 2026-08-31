import type { ProbeData } from "#probe/read-probe-data.ts";
import { buildProbeView } from "#detect/probe-view.ts";
import { decodeHtmlAttribute, extractPlatformHints } from "#detect/hints.ts";
import { platformHintsSchema } from "#ir/detect.ts";

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

describe("decodeHtmlAttribute", () => {
  it("decodes &quot; &#34; &amp; &lt; &gt; &#39;", () => {
    expect(decodeHtmlAttribute("&quot;a&quot; &#34;b&#34; &amp; &lt;c&gt; &#39;d&#39;")).toBe('"a" "b" & <c> \'d\'');
  });

  it("decodes &amp; last, avoiding double-decoding", () => {
    expect(decodeHtmlAttribute("&amp;quot;")).toBe("&quot;");
  });
});

describe("extractPlatformHints", () => {
  it("extracts the webflow data-wf-* triad from the <html> tag", () => {
    const view = buildProbeView(
      probeData({
        homeHtml:
          '<html data-wf-page="686294e363eb7e215bd2334b" data-wf-site="60a1c1234567890abcdef12" data-wf-domain="example.webflow.io"><head></head><body></body></html>',
      }),
    );

    const result = extractPlatformHints(view);

    expect(result.webflowPageId).toBe("686294e363eb7e215bd2334b");
    expect(result.webflowSiteId).toBe("60a1c1234567890abcdef12");
    expect(result.webflowDomain).toBe("example.webflow.io");
    expect(() => platformHintsSchema.parse(result)).not.toThrow();
  });

  it("returns an object with all fields absent for an empty view", () => {
    const view = buildProbeView(probeData());

    const result = extractPlatformHints(view);

    expect(result).toEqual({});
    expect(() => platformHintsSchema.parse(result)).not.toThrow();
  });
});
