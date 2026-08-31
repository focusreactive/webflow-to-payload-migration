import { DETECT_STEP_ID } from "#detect/constants/ids.ts";
import { detectPlatform } from "#detect/detect-platform.ts";
import { CONFIDENCE_THRESHOLD } from "#detect/scoring.ts";
import { detectDataSchema } from "#ir/detect.ts";
import type { ProbeData } from "#probe/read-probe-data.ts";

type Http = ProbeData["homeHttp"];

function http(overrides: Partial<Http> = {}): Http {
  return {
    status: 200,
    finalUrl: "https://example.com/",
    redirectChain: [],
    headers: {},
    ...overrides,
  };
}

function probeData(overrides: Partial<ProbeData> = {}): ProbeData {
  return {
    sourceUrl: "https://example.com/",
    homeHtml: "<html><head></head><body></body></html>",
    homeHttp: http(),
    ...overrides,
  };
}

// A direct tier-1 fingerprint: the data-wf-* triad on <html>, the jQuery CDN
// bundle with ?site=<siteId>, and the .schunk. JS chunk marker.
const WEBFLOW_HTML = `<html data-wf-page="686294e363eb7e215bd2334b" data-wf-site="686294e263eb7e215bd232f7" data-wf-domain="example.webflow.io"><head></head><body>
<script src="https://d3e54v103j8qbb.cloudfront.net/js/jquery-3.5.1.min.dc5e7f18c8.js?site=686294e263eb7e215bd232f7"></script>
<script src="https://cdn.prod.website-files.com/686294e263eb7e215bd232f7/js/webflow.schunk.3e86f6916b809136.js"></script>
</body></html>`;

const PLAIN_HTML = "<html><head></head><body><p>Hello world</p></body></html>";

describe("detectPlatform", () => {
  it("exposes the detect step id", () => {
    expect(DETECT_STEP_ID).toBe("detect");
  });

  it("detects a Webflow-like page: verdict webflow, hints.webflowSiteId populated", () => {
    const result = detectPlatform(probeData({ homeHtml: WEBFLOW_HTML }));

    expect(result.verdict).toBe("webflow");
    expect(result.platformHints.webflowSiteId).toBe("686294e263eb7e215bd232f7");
    expect(() => detectDataSchema.parse(result)).not.toThrow();
  });

  it("reports unknown with a zero score for plain HTML with no platform signals", () => {
    const result = detectPlatform(probeData({ homeHtml: PLAIN_HTML }));

    expect(result.verdict).toBe("unknown");
    expect(result.scores.webflow.score).toBe(0);
    expect(() => detectDataSchema.parse(result)).not.toThrow();
  });

  it("wires thresholds from the scoring module constants", () => {
    const result = detectPlatform(probeData());

    expect(result.thresholds).toEqual({ confidence: CONFIDENCE_THRESHOLD });
  });

  it("is pure: its only input is ProbeData", () => {
    // ProbeData carries no platform-forcing field, and detectPlatform's only
    // parameter is ProbeData — the honest verdict is always what gets computed here.
    const a = detectPlatform(probeData({ homeHtml: WEBFLOW_HTML }));
    const b = detectPlatform(probeData({ homeHtml: WEBFLOW_HTML }));
    expect(a).toEqual(b);
  });
});
