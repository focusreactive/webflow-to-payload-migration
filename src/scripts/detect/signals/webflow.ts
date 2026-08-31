import type { Signal } from "#detect/types.ts";
import { countMatches, hit, hostname, inRegion } from "#detect/utils/signal-match.ts";

const WF_WIDGET_CLASSES: { label: string; re: RegExp }[] = [
  { label: "w-form", re: /\bw-form\b/ },
  { label: "w-input", re: /\bw-input\b/ },
  { label: "w-button", re: /\bw-button\b/ },
  { label: "w-dropdown", re: /\bw-dropdown\b/ },
  { label: "w-tabs", re: /\bw-tabs\b/ },
  { label: "w-slider", re: /\bw-slider\b/ },
  { label: "w-lightbox", re: /\bw-lightbox\b/ },
  { label: "w-checkbox", re: /\bw-checkbox\b/ },
  { label: "w-container", re: /\bw-container\b/ },
  { label: "w-clearfix", re: /\bw-clearfix\b/ },
  { label: "w-icon-*", re: /\bw-icon-[a-z0-9-]+\b/ },
  { label: "w-layout-grid", re: /\bw-layout-grid\b/ },
];

const WHITELIST_MIN_DISTINCT = 3;
const ASSET_DOMAIN_MIN_HITS = 5;
const HTTP_NOT_FOUND = 404;

export const webflowSignals: Signal[] = [
  {
    id: "wf-html-data-wf-page",
    platform: "webflow",
    description: 'data-wf-page="<24hex>" pageId on <html> (row 1)',
    tier: "strong",
    tier1Html: true,
    match: inRegion("htmlTag", /data-wf-page="[0-9a-f]{24}"/i),
  },
  {
    id: "wf-html-data-wf-site",
    platform: "webflow",
    description: 'data-wf-site="<24hex>" siteId on <html> (row 2)',
    tier: "strong",
    tier1Html: true,
    match: inRegion("htmlTag", /data-wf-site="[0-9a-f]{24}"/i),
  },
  {
    id: "wf-html-data-wf-domain",
    platform: "webflow",
    description: 'data-wf-domain="<host>" published host on <html> (row 3)',
    tier: "strong",
    tier1Html: true,
    match: inRegion("htmlTag", /data-wf-domain="[^"]+"/i),
  },
  {
    id: "wf-html-data-wf-collection",
    platform: "webflow",
    description: 'data-wf-collection="<24hex>" on CMS template <html> (row 4)',
    tier: "strong",
    match: inRegion("htmlTag", /data-wf-collection="[0-9a-f]{24}"/i),
  },
  {
    id: "wf-html-data-wf-item-slug",
    platform: "webflow",
    description: 'data-wf-item-slug="<slug>" on CMS template <html> (row 5)',
    tier: "strong",
    match: inRegion("htmlTag", /data-wf-item-slug="[^"]+"/i),
  },
  {
    id: "wf-body-data-wf-element-id",
    platform: "webflow",
    description: 'data-wf-element-id="<uuid>" on elements (row 6)',
    tier: "medium",
    match: inRegion("fullHtml", /data-wf-element-id="[0-9a-f]{8}-[0-9a-f-]{20,}"/i),
  },
  {
    id: "wf-attr-data-wf-component-prop",
    platform: "webflow",
    description: 'data-wf--<component>--<prop>="<variant>" component var (row 7)',
    tier: "medium",
    match: inRegion("fullHtml", /data-wf--[a-z0-9-]+--[a-z0-9-]+="[^"]*"/i),
  },
  {
    id: "wf-meta-generator",
    platform: "webflow",
    description: "meta name=generator content=Webflow, either order (row 8)",
    tier: "medium",
    match: inRegion(
      "fullHtml",
      /<meta\b[^>]*(?:name="generator"[^>]*content="Webflow"|content="Webflow"[^>]*name="generator")[^>]*>/i,
    ),
  },
  {
    id: "wf-comment-created-in",
    platform: "webflow",
    description: 'HTML comment "This site was created/built in Webflow" (row 9)',
    tier: "medium",
    match: inRegion("fullHtml", /<!--\s*This site was (?:created|built) in Webflow/i),
  },
  {
    id: "wf-comment-last-published",
    platform: "webflow",
    description: 'HTML comment "Last Published: ... GMT+0000" (row 10)',
    tier: "strong",
    tier1Html: true,
    match: inRegion("fullHtml", /<!--\s*Last Published:[^]*?GMT\+0000/i),
  },
  {
    id: "wf-css-website-files",
    platform: "webflow",
    description: "stylesheet website-files.com/<24hex>/css/*.min.css, both variants (row 11)",
    tier: "strong",
    tier1Html: true,
    match: inRegion("fullHtml", /website-files\.com\/[0-9a-f]{24}\/css\/[^"']+\.min\.css/i),
  },
  {
    id: "wf-head-inline-wmod",
    platform: "webflow",
    description: 'inline touch-detection script with t=" w-mod-" + DocumentTouch (row 12)',
    tier: "strong",
    tier1Html: true,
    match: (view) =>
      /t=" w-mod-"/.test(view.fullHtml) && /DocumentTouch/.test(view.fullHtml) ?
        hit("inline w-mod- touch-detection script (DocumentTouch)")
      : null,
  },
  {
    id: "wf-favicon-website-files",
    platform: "webflow",
    description: "favicon link served from website-files.com (row 13)",
    tier: "medium",
    family: "wf-assets",
    match: inRegion(
      "fullHtml",
      /<link\b[^>]*rel="(?:shortcut icon|icon)"[^>]*href="https:\/\/[^"']*website-files\.com[^"']*"/i,
    ),
  },
  {
    id: "wf-appletouch-webclip",
    platform: "webflow",
    description: 'apple-touch-icon on website-files.com, often "webclip" (row 14)',
    tier: "medium",
    family: "wf-assets",
    match: inRegion(
      "fullHtml",
      /(?:<link\b[^>]*rel="apple-touch-icon"[^>]*website-files\.com|website-files\.com\/[^"']*webclip)/i,
    ),
  },
  {
    id: "wf-webfont-loader",
    platform: "webflow",
    description: "WebFont loader 1.6.26 from ajax.googleapis.com (row 15)",
    tier: "weak",
    match: inRegion("fullHtml", /ajax\.googleapis\.com\/ajax\/libs\/webfont\/1\.6\.26\/webfont\.js/i),
  },
  {
    id: "wf-jquery-cdn",
    platform: "webflow",
    description: "jQuery on d3e54v103j8qbb.cloudfront.net with ?site=<24hex> (row 16)",
    tier: "strong",
    tier1Html: true,
    match: inRegion(
      "fullHtml",
      /d3e54v103j8qbb\.cloudfront\.net\/js\/jquery-[\d.]+\.min\.[0-9a-f]+\.js\?site=[0-9a-f]{24}/i,
    ),
  },
  {
    id: "wf-js-website-files",
    platform: "webflow",
    description: "main JS bundle website-files.com/<24hex>/js/ (row 17)",
    tier: "strong",
    match: inRegion("fullHtml", /website-files\.com\/[0-9a-f]{24}\/js\//i),
  },
  {
    id: "wf-js-schunk",
    platform: "webflow",
    description: "site-chunk JS marker .schunk.<16hex>.js (row 18)",
    tier: "strong",
    tier1Html: true,
    match: inRegion("fullHtml", /\.schunk\.[0-9a-f]{16}\.js/i),
  },
  {
    id: "wf-asset-website-files",
    platform: "webflow",
    description: "cdn.prod.website-files.com — siteId cross-check OR >=5 hits (row 19)",
    tier: "strong",
    family: "wf-assets",
    match: (view) => {
      const siteId = /data-wf-site="([0-9a-f]{24})"/i.exec(view.htmlTag)?.[1];
      if (siteId && new RegExp(`website-files\\.com/${siteId}`, "i").test(view.fullHtml)) {
        return hit(`cdn.prod.website-files.com/${siteId} (siteId cross-check)`);
      }
      const count = countMatches(/cdn\.prod\.website-files\.com/gi, view.fullHtml);
      return count >= ASSET_DOMAIN_MIN_HITS ? hit(`cdn.prod.website-files.com ×${count}`) : null;
    },
  },
  {
    id: "wf-asset-legacy-domains",
    platform: "webflow",
    description: "legacy asset domains: uploads-ssl / assets(-global).website-files / daks2k3a4ib2z (row 20)",
    tier: "strong",
    family: "wf-assets",
    match: inRegion(
      "fullHtml",
      /(?:uploads-ssl\.webflow\.com|assets(?:-global)?\.website-files\.com|daks2k3a4ib2z\.cloudfront\.net)\//i,
    ),
  },
  {
    id: "wf-inline-window-webflow",
    platform: "webflow",
    description: "window.Webflow||=[] / Webflow.push|require() global (row 21)",
    tier: "weak",
    match: inRegion("fullHtml", /window\.Webflow\s*(?:\|\|=|=\s*window\.Webflow\s*\|\|)|Webflow\.(?:push|require)\(/),
  },
  {
    id: "wf-class-w-nav",
    platform: "webflow",
    description: "w-nav navbar component class (row 22)",
    tier: "strong",
    family: "wf-w-classes",
    match: inRegion("fullHtml", /\bw-nav\b/),
  },
  {
    id: "wf-class-w-dyn",
    platform: "webflow",
    description: "w-dyn-list / w-dyn-items / w-dyn-item CMS wrappers (row 23)",
    tier: "strong",
    family: "wf-w-classes",
    match: inRegion("fullHtml", /\bw-dyn-(?:list|items|item)\b/),
  },
  {
    id: "wf-class-w-current",
    platform: "webflow",
    description: "w--current active-nav modifier (row 24)",
    tier: "strong",
    family: "wf-w-classes",
    match: inRegion("fullHtml", /\bw--current\b/),
  },
  {
    id: "wf-class-w-inline-block",
    platform: "webflow",
    description: "w-inline-block link-block class (row 25)",
    tier: "strong",
    family: "wf-w-classes",
    match: inRegion("fullHtml", /\bw-inline-block\b/),
  },
  {
    id: "wf-class-w-embed",
    platform: "webflow",
    description: "w-embed HTML/code embed class (row 26)",
    tier: "medium",
    family: "wf-w-classes",
    match: inRegion("fullHtml", /\bw-embed\b/),
  },
  {
    id: "wf-body-data-w-id",
    platform: "webflow",
    description: 'data-w-id="<uuid>" IX2/IX3 interaction attribute (row 27)',
    tier: "strong",
    match: inRegion("fullHtml", /data-w-id="[0-9a-f]{8}-[0-9a-f-]{20,}"/i),
  },
  {
    id: "wf-style-wmod-ix",
    platform: "webflow",
    description: "inline IX2 style selector html.w-mod-js:not(.w-mod-ix) (row 28)",
    tier: "medium",
    match: inRegion("fullHtml", /w-mod-js:not\(\.w-mod-ix\)/),
  },
  {
    id: "wf-class-w-richtext",
    platform: "webflow",
    description: "w-richtext rich-text field class (row 29)",
    tier: "medium",
    family: "wf-w-classes",
    match: inRegion("fullHtml", /\bw-richtext\b/),
  },
  {
    id: "wf-class-w-condition-invisible",
    platform: "webflow",
    description: "w-condition-invisible conditional-visibility class (row 30)",
    tier: "medium",
    family: "wf-w-classes",
    match: inRegion("fullHtml", /\bw-condition-invisible\b/),
  },
  {
    id: "wf-class-w-whitelist",
    platform: "webflow",
    description: ">=3 distinct whitelisted w-* form/widget classes (rows 31 + 32) = one hit",
    tier: "medium",
    family: "wf-w-classes",
    match: (view) => {
      const distinct = WF_WIDGET_CLASSES.filter(({ re }) => re.test(view.fullHtml));
      return distinct.length >= WHITELIST_MIN_DISTINCT ?
          hit(
            `${distinct.length} distinct w-* widget classes: ${distinct
              .slice(0, 6)
              .map(({ label }) => label)
              .join(", ")}`,
          )
        : null;
    },
  },
  {
    id: "wf-class-w-webflow-badge",
    platform: "webflow",
    description: "w-webflow-badge runtime badge class / CSS hide-hack (row 33)",
    tier: "weak",
    family: "wf-w-classes",
    match: inRegion("fullHtml", /\bw-webflow-badge\b/),
  },
  {
    id: "wf-header-x-lambda-id",
    platform: "webflow",
    description: "x-lambda-id: <uuid> render-lambda header (row 34)",
    tier: "strong",
    match: (view) => {
      const value = view.headers["x-lambda-id"];
      return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ?
          hit(`x-lambda-id: ${value}`)
        : null;
    },
  },
  {
    id: "wf-header-x-wf",
    platform: "webflow",
    description: "any x-wf-* response header (row 35)",
    tier: "strong",
    match: (view) => {
      const entry = Object.entries(view.headers).find(([key]) => key.startsWith("x-wf-"));
      return entry ? hit(`${entry[0]}: ${entry[1]}`) : null;
    },
  },
  {
    id: "wf-header-surrogate-key",
    platform: "webflow",
    description: "surrogate-key with <24hex> siteId and pageId: (row 36)",
    tier: "strong",
    match: (view) => {
      const value = view.headers["surrogate-key"];
      return value && /[0-9a-f]{24}/i.test(value) && /pageId:/i.test(value) ? hit(`surrogate-key: ${value}`) : null;
    },
  },
  {
    id: "wf-header-surrogate-control",
    platform: "webflow",
    description: "surrogate-control: max-age=432000 (row 37)",
    tier: "medium",
    match: (view) =>
      view.headers["surrogate-control"]?.includes("max-age=432000") ?
        hit(`surrogate-control: ${view.headers["surrogate-control"]}`)
      : null,
  },
  {
    id: "wf-header-csp-webflow",
    platform: "webflow",
    description: "CSP frame-ancestors listing *.webflow.io/.com (row 38)",
    tier: "medium",
    match: (view) => {
      const csp = view.headers["content-security-policy"];
      return csp && /frame-ancestors[^;]*\*\.webflow\.(?:io|com)/i.test(csp) ?
          hit("content-security-policy frame-ancestors *.webflow.*")
        : null;
    },
  },
  {
    id: "wf-header-cloudflare",
    platform: "webflow",
    description:
      "Cloudflare headers (server: cloudflare / cf-ray / _cfuvid) ONLY together with a Webflow-specific header x-wf-* / x-lambda-id / surrogate-key (row 39)",
    tier: "weak",
    match: (view) => {
      const cloudflare =
        /cloudflare/i.test(view.headers["server"] ?? "")
        || "cf-ray" in view.headers
        || (view.headers["set-cookie"]?.includes("_cfuvid") ?? false);
      if (!cloudflare) return null;
      const webflowSpecific = Object.entries(view.headers).find(
        ([key, value]) =>
          key.startsWith("x-wf-")
          || (key === "x-lambda-id" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
          || (key === "surrogate-key" && /[0-9a-f]{24}/i.test(value) && /pageId:/i.test(value)),
      );
      return webflowSpecific ? hit(`cloudflare + webflow-specific header ${webflowSpecific[0]}`) : null;
    },
  },
  {
    id: "wf-header-last-modified",
    platform: "webflow",
    description: "last-modified header correlating with Last Published comment (row 40)",
    tier: "weak",
    match: (view) =>
      view.headers["last-modified"] && /<!--\s*Last Published:/i.test(view.fullHtml) ?
        hit(`last-modified: ${view.headers["last-modified"]}`)
      : null,
  },
  {
    id: "wf-url-webflow-io",
    platform: "webflow",
    description: "host *.webflow.io staging domain (row 41)",
    tier: "strong",
    instant: true,
    tier1Html: true,
    match: (view) => {
      for (const url of [view.finalUrl, view.sourceUrl]) {
        const host = hostname(url);
        if (host && /\.webflow\.io$/.test(host)) return hit(`host ${host}`);
      }
      return null;
    },
  },
  {
    id: "wf-404-data-wf",
    platform: "webflow",
    description: "404 page still carries data-wf-page/site (row 42)",
    tier: "medium",
    match: (view) =>
      (
        view.notFound
        && view.notFound.status === HTTP_NOT_FOUND
        && /data-wf-(?:page|site)="[0-9a-f]{24}"/i.test(view.notFound.html)
      ) ?
        hit(`404 with data-wf-* (status ${view.notFound.status})`)
      : null,
  },
  {
    id: "wf-sitemap-xhtml",
    platform: "webflow",
    description: "sitemap.xml urlset with sitemap/0.9 + xmlns:xhtml (row 43)",
    tier: "weak",
    match: (view) =>
      (
        view.sitemapXml
        && /sitemap\/0\.9/.test(view.sitemapXml)
        && /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/.test(view.sitemapXml)
      ) ?
        hit("sitemap.xml urlset with xmlns:xhtml + sitemap/0.9")
      : null,
  },
];
