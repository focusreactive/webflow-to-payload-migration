import { loadHtml } from "#lib/html.ts";

export interface PaginationInfo {
  seed: string;
  pageCount: number;
}

const SEED_PATTERN = /[?&]([^?&=]+)_page=/;
const PAGE_COUNT_PATTERN = /\/\s*(\d+)/;
const DEFAULT_PAGE_COUNT = 1;

export function findPaginations(html: string): PaginationInfo[] {
  const $ = loadHtml(html);
  const infos: PaginationInfo[] = [];

  $(".w-dyn-list").each((_, el) => {
    const wrapper = $(el)
      .find(".w-pagination-wrapper")
      .filter((_, wrapperEl) => $(wrapperEl).closest(".w-dyn-list").get(0) === el)
      .first();
    if (wrapper.length === 0) return;

    const nextHref = wrapper.find(".w-pagination-next").first().attr("href");
    const prerenderHref = wrapper.find('link[rel="prerender"]').first().attr("href");
    const href = nextHref ?? prerenderHref;
    if (href === undefined) return;

    const seedMatch = SEED_PATTERN.exec(href);
    const seed = seedMatch?.[1];
    if (seed === undefined) return;

    const countText = wrapper.find(".w-page-count").first().text();
    const countMatch = PAGE_COUNT_PATTERN.exec(countText);
    const count = countMatch?.[1];
    const pageCount = count === undefined ? DEFAULT_PAGE_COUNT : Number(count);

    infos.push({ seed, pageCount });
  });

  return infos;
}

export function paginationUrls(pageUrl: string, info: PaginationInfo): string[] {
  const urls: string[] = [];

  for (let page = 2; page <= info.pageCount; page += 1) {
    const url = new URL(pageUrl);
    url.searchParams.set(`${info.seed}_page`, String(page));
    urls.push(url.toString());
  }

  return urls;
}
