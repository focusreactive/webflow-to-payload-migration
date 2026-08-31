import { loadHtml } from "#lib/html.ts";

export const ASSET_ROUTE_PREFIX = "/a/";
export const URL_ATTRIBUTES = ["src", "href", "poster", "data-src", "data-poster-url"] as const;
export const URL_LIST_ATTRIBUTES = ["srcset", "data-srcset", "data-video-urls"] as const;

const SKIPPED_URL_PREFIXES = ["data:", "blob:", "#", "javascript:", "mailto:", "tel:"];
const CSS_URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

const INTEGRITY_ATTRIBUTES = ["integrity", "crossorigin"] as const;

// The map is built from index.rendered.html — the post-hydration DOM — so stamping runs on
// `load`, after the page's own scripts have finished building the tree the map describes.
const ANCHOR_STAMPER = `
window.addEventListener("load", function () {
  setTimeout(function () {
    var tag = document.querySelector('script[type="application/json"][data-mig-anchors]');
    if (tag === null) return;
    var map = JSON.parse(tag.textContent || "{}");
    var stamped = 0;
    var missing = [];
    for (var id in map) {
      var node = document.body;
      var path = map[id];
      for (var i = 0; i < path.length && node; i += 1) node = node.children[path[i]];
      if (node) { node.setAttribute("data-mig-id", id); stamped += 1; } else { missing.push(id); }
    }
    window.__migStamped = { total: Object.keys(map).length, stamped: stamped, missing: missing };
  }, 0);
});
`;

export type IdResolver = (url: string) => string | undefined;

function assetPath(id: string): string {
  return `${ASSET_ROUTE_PREFIX}${id}`;
}

// `href` also appears on <a>, <area> and <base>, whose targets are navigation,
// not asset fetches — rewriting those would send the reference page to the
// asset route instead of the page it links to. Scope href to <link> (icons,
// stylesheets, preloads), where the browser itself fetches the target as a
// resource.
function attributeSelector(attribute: string): string {
  return attribute === "href" ? "link[href]" : `[${attribute}]`;
}

function rewriteOne(raw: string, baseUrl: string, idFor: IdResolver): string {
  const value = raw.trim();
  if (value === "" || SKIPPED_URL_PREFIXES.some((prefix) => value.startsWith(prefix))) return raw;
  let absolute: string;
  try {
    absolute = new URL(value, baseUrl).href;
  } catch {
    return raw;
  }
  const id = idFor(absolute);
  return id === undefined ? raw : assetPath(id);
}

function rewriteList(raw: string, baseUrl: string, idFor: IdResolver): string {
  return raw
    .split(",")
    .map((entry) => {
      const trimmed = entry.trim();
      if (trimmed === "") return entry;
      const [url, ...descriptor] = trimmed.split(/\s+/);
      if (url === undefined) return entry;
      const rewritten = rewriteOne(url, baseUrl, idFor);
      return [rewritten, ...descriptor].join(" ");
    })
    .join(",");
}

export interface RewriteCssOptions {
  css: string;
  baseUrl: string;
  idFor: IdResolver;
}

export function rewriteCss(opts: RewriteCssOptions): string {
  return opts.css.replaceAll(CSS_URL_PATTERN, (match, quote: string, url: string) => {
    const rewritten = rewriteOne(url, opts.baseUrl, opts.idFor);
    return rewritten === url ? match : `url(${quote}${rewritten}${quote})`;
  });
}

function escapeMarkupInJson(json: string): string {
  return json.replaceAll("<", "\\u003c");
}

export interface RewriteHtmlOptions {
  html: string;
  baseUrl: string;
  idFor: IdResolver;
  fontsCss: string;
  anchors?: string;
}

export function rewriteHtml(opts: RewriteHtmlOptions): string {
  const $ = loadHtml(opts.html);

  for (const attribute of URL_ATTRIBUTES) {
    $(attributeSelector(attribute)).each((_, element) => {
      const node = $(element);
      const value = node.attr(attribute);
      if (value === undefined) return;
      const rewritten = rewriteOne(value, opts.baseUrl, opts.idFor);
      if (rewritten === value) return;
      node.attr(attribute, rewritten);
      for (const stale of INTEGRITY_ATTRIBUTES) node.removeAttr(stale);
    });
  }

  for (const attribute of URL_LIST_ATTRIBUTES) {
    $(`[${attribute}]`).each((_, element) => {
      const node = $(element);
      const value = node.attr(attribute);
      if (value === undefined) return;
      const rewritten = rewriteList(value, opts.baseUrl, opts.idFor);
      if (rewritten === value) return;
      node.attr(attribute, rewritten);
      for (const stale of INTEGRITY_ATTRIBUTES) node.removeAttr(stale);
    });
  }

  $("style").each((_, element) => {
    const node = $(element);
    node.text(rewriteCss({ css: node.text(), baseUrl: opts.baseUrl, idFor: opts.idFor }));
  });

  const head = $("head");
  const target = head.length > 0 ? head : $("html");
  if (opts.fontsCss !== "") target.append(`<style data-mig-fonts>\n${opts.fontsCss}</style>`);
  if (opts.anchors !== undefined) {
    target.append(`<script type="application/json" data-mig-anchors>${escapeMarkupInJson(opts.anchors)}</script>`);
    target.append(`<script data-mig-stamp>${ANCHOR_STAMPER}</script>`);
  }

  return $.html();
}
