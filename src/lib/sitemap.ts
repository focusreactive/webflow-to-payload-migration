import { load } from "cheerio";

export interface SitemapAlternate {
  hreflang: string;
  href: string;
}

export interface SitemapEntry {
  loc: string;
  alternates: SitemapAlternate[];
}

export interface ParsedSitemap {
  kind: "urlset" | "sitemapindex" | "unknown";
  entries: SitemapEntry[];
}

interface TagNamed {
  tagName: string;
}

export function parseSitemap(xml: string): ParsedSitemap {
  const $ = load(xml, { xmlMode: true });
  const root = $.root().children().first();
  const rootEl = root.get(0);
  const rootTag = rootEl === undefined ? undefined : localName(rootEl);

  const locText = (parent: typeof root) =>
    parent
      .children()
      .filter((_, el) => localName(el) === "loc")
      .first()
      .text()
      .trim();

  if (rootTag === "urlset") {
    const entries = root
      .children()
      .filter((_, el) => localName(el) === "url")
      .toArray()
      .map((urlEl) => {
        const url = $(urlEl);
        const alternates: SitemapAlternate[] = [];

        url
          .children()
          .filter((_, el) => localName(el) === "link")
          .each((_, el) => {
            const $el = $(el);
            const rel = $el.attr("rel");
            const hreflang = $el.attr("hreflang");
            const href = $el.attr("href");

            if (rel === "alternate" && hreflang !== undefined && href !== undefined) {
              alternates.push({ hreflang, href });
            }
          });

        return { loc: locText(url), alternates };
      });

    return { kind: "urlset", entries };
  }

  if (rootTag === "sitemapindex") {
    const entries = root
      .children()
      .filter((_, el) => localName(el) === "sitemap")
      .toArray()
      .map((sitemapEl) => ({
        loc: locText($(sitemapEl)),
        alternates: [],
      }));

    return { kind: "sitemapindex", entries };
  }

  return { kind: "unknown", entries: [] };
}

function localName(el: TagNamed): string {
  const name = el.tagName;
  const colonIndex = name.indexOf(":");

  return colonIndex === -1 ? name : name.slice(colonIndex + 1);
}
