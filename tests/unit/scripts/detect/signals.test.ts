import { buildProbeView, type ProbeView } from "#detect/probe-view.ts";
import type { Signal } from "#detect/types.ts";
import { webflowSignals } from "#detect/signals/webflow.ts";
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

function view(overrides: Partial<ProbeData> = {}): ProbeView {
  return buildProbeView({
    sourceUrl: "https://example.com/",
    homeHtml: "<html><head></head><body></body></html>",
    homeHttp: http(),
    ...overrides,
  });
}

function find(signals: Signal[], id: string): Signal {
  const signal = signals.find((s) => s.id === id);
  if (!signal) throw new Error(`unknown signal id: ${id}`);
  return signal;
}

const allSignals = webflowSignals;

describe("signal registry invariants", () => {
  it("has ids unique across the registry", () => {
    const ids = allSignals.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("follows the id mnemonic", () => {
    expect(webflowSignals.every((s) => s.id.startsWith("wf-"))).toBe(true);
  });

  it("tags every webflow signal with platform webflow", () => {
    expect(webflowSignals.every((s) => s.platform === "webflow")).toBe(true);
  });

  it("gives the registry at least one instant host signal", () => {
    expect(webflowSignals.filter((s) => s.instant).length).toBeGreaterThanOrEqual(1);
  });

  it("gives the registry at least five tier1Html signals", () => {
    expect(webflowSignals.filter((s) => s.tier1Html).length).toBeGreaterThanOrEqual(5);
  });

  it("marks every instant signal as tier1Html", () => {
    expect(allSignals.filter((s) => s.instant).every((s) => s.tier1Html)).toBe(true);
  });
});

describe("webflow matchers", () => {
  it("matches the data-wf-* triad from the <html> tag", () => {
    const v = view({
      homeHtml:
        '<html lang="en" data-wf-page="686294e363eb7e215bd2334b" data-wf-site="686294e263eb7e215bd232f7" data-wf-domain="wf.finsweet.com"><head></head><body></body></html>',
    });
    expect(find(webflowSignals, "wf-html-data-wf-page").match(v)).not.toBeNull();
    expect(find(webflowSignals, "wf-html-data-wf-site").match(v)).not.toBeNull();
    expect(find(webflowSignals, "wf-html-data-wf-domain").match(v)).not.toBeNull();
  });

  it("matches the .schunk. JS chunk marker from fullHtml", () => {
    const v = view({
      homeHtml:
        '<html><body><script src="https://cdn.prod.website-files.com/686294e263eb7e215bd232f7/js/webflow.schunk.3e86f6916b809136.js"></script></body></html>',
    });
    expect(find(webflowSignals, "wf-js-schunk").match(v)).not.toBeNull();
  });

  it("matches the inline w-mod- touch-detection script from the head", () => {
    const v = view({
      homeHtml:
        '<html><head><script>!function(o,c){var n=c.documentElement,t=" w-mod-";n.className+=t+"js",("ontouchstart"in o||o.DocumentTouch&&c instanceof DocumentTouch)&&(n.className+=t+"touch")}(window,document);</script></head><body></body></html>',
    });
    expect(find(webflowSignals, "wf-head-inline-wmod").match(v)).not.toBeNull();
  });

  it("matches the jQuery CDN bundle with ?site=", () => {
    const v = view({
      homeHtml:
        '<html><body><script src="https://d3e54v103j8qbb.cloudfront.net/js/jquery-3.5.1.min.dc5e7f18c8.js?site=686294e263eb7e215bd232f7"></script></body></html>',
    });
    expect(find(webflowSignals, "wf-jquery-cdn").match(v)).not.toBeNull();
  });

  it("matches the Last Published comment", () => {
    const v = view({
      homeHtml:
        "<!-- Last Published: Tue Jul 07 2026 13:10:32 GMT+0000 (Coordinated Universal Time) --><html><body></body></html>",
    });
    expect(find(webflowSignals, "wf-comment-last-published").match(v)).not.toBeNull();
  });

  it("matches meta generator=Webflow but not generator=WordPress", () => {
    const wf = view({
      homeHtml: '<html><head><meta content="Webflow" name="generator"/></head></html>',
    });
    const wp = view({
      homeHtml: '<html><head><meta name="generator" content="WordPress 6.9.4"/></head></html>',
    });
    expect(find(webflowSignals, "wf-meta-generator").match(wf)).not.toBeNull();
    expect(find(webflowSignals, "wf-meta-generator").match(wp)).toBeNull();
  });

  it("counts distinct row-31/32 widget classes (>=3 = one hit)", () => {
    // Two widget classes -> below threshold.
    const two = view({
      homeHtml: '<html><body class="w-form w-input"></body></html>',
    });
    // Three distinct widget classes (incl. w-icon-* prefix) -> one hit.
    const three = view({
      homeHtml: '<html><body class="w-form w-input w-icon-nav-menu"></body></html>',
    });
    // Classes that have their OWN dedicated signal must NOT feed this counter.
    const dedicatedOnly = view({
      homeHtml: '<html><body class="w-nav w-inline-block w-dyn-list w-embed w-richtext"></body></html>',
    });
    expect(find(webflowSignals, "wf-class-w-whitelist").match(two)).toBeNull();
    expect(find(webflowSignals, "wf-class-w-whitelist").match(three)).not.toBeNull();
    expect(find(webflowSignals, "wf-class-w-whitelist").match(dedicatedOnly)).toBeNull();
  });

  it("requires siteId cross-check or >=5 hits for the asset domain", () => {
    const single = view({
      homeHtml: '<html><body><img src="https://cdn.prod.website-files.com/abc/one.png"></body></html>',
    });
    const many = view({
      homeHtml: `<html><body>${'<img src="https://cdn.prod.website-files.com/x/a.png">'.repeat(5)}</body></html>`,
    });
    expect(find(webflowSignals, "wf-asset-website-files").match(single)).toBeNull();
    expect(find(webflowSignals, "wf-asset-website-files").match(many)).not.toBeNull();
  });

  it("matches the 404 probe carrying data-wf-* attributes", () => {
    const v = view({
      notFound: {
        status: 404,
        html: '<html data-wf-page="61e98e4a63eb7e215bd2334b"><title>Not Found</title></html>',
      },
    });
    expect(find(webflowSignals, "wf-404-data-wf").match(v)).not.toBeNull();
  });

  it("matches webflow HTTP headers", () => {
    const v = view({
      homeHttp: http({
        headers: {
          "x-lambda-id": "cd83b028-5416-4465-b6b3-f946cebd33ac",
          "x-wf-region": "us-east-1",
          "surrogate-key": "marketing.flowbase.co 5beab1239ac88487c3a6608f pageId:6489101ec0a2086ed38d5625",
        },
      }),
    });
    expect(find(webflowSignals, "wf-header-x-lambda-id").match(v)).not.toBeNull();
    expect(find(webflowSignals, "wf-header-x-wf").match(v)).not.toBeNull();
    expect(find(webflowSignals, "wf-header-surrogate-key").match(v)).not.toBeNull();
  });

  it("does NOT fire the cloudflare signal on Cloudflare-only headers", () => {
    // server: cloudflare + cf-ray always co-occur behind Cloudflare and must
    // not be a standalone Webflow signal (research/01 row 39 + risks).
    const cloudflareOnly = view({
      homeHttp: http({
        headers: { server: "cloudflare", "cf-ray": "8f2a1b3c4d5e6f70-FRA" },
      }),
    });
    expect(find(webflowSignals, "wf-header-cloudflare").match(cloudflareOnly)).toBeNull();
    // And the registry as a whole produces zero hits for this response.
    for (const signal of webflowSignals) {
      expect(signal.match(cloudflareOnly), `signal ${signal.id} should not match Cloudflare-only headers`).toBeNull();
    }
    // But WITH a Webflow-specific header alongside Cloudflare it does fire.
    const cloudflarePlusWebflow = view({
      homeHttp: http({
        headers: {
          server: "cloudflare",
          "cf-ray": "8f2a1b3c4d5e6f70-FRA",
          "x-wf-region": "us-east-1",
        },
      }),
    });
    expect(find(webflowSignals, "wf-header-cloudflare").match(cloudflarePlusWebflow)).not.toBeNull();
  });

  it("fires the instant signal on a *.webflow.io host (finalUrl or sourceUrl)", () => {
    const byFinal = view({
      homeHttp: http({ finalUrl: "https://example.webflow.io/" }),
    });
    const bySource = view({ sourceUrl: "https://example.webflow.io/" });
    expect(find(webflowSignals, "wf-url-webflow-io").match(byFinal)).not.toBeNull();
    expect(find(webflowSignals, "wf-url-webflow-io").match(bySource)).not.toBeNull();
  });

  it("produces ZERO hits for a page that merely mentions webflow in text", () => {
    const v = view({
      homeHtml:
        '<html><head></head><body><p>We migrated away from Webflow to Vercel last year.</p><a href="/vs/webflow">Webflow vs us</a></body></html>',
    });
    for (const signal of webflowSignals) {
      expect(signal.match(v), `signal ${signal.id} should not match`).toBeNull();
    }
  });
});

