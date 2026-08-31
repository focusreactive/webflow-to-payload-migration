import { loadHtml } from "#lib/html.ts";

export interface WebflowPageClass {
  isWebflow: boolean;
  kind: "static" | "item";
  collectionKey?: string;
  slug?: string;
  pageId?: string;
  localeId?: string;
}

export function classifyWebflowPage(html: string): WebflowPageClass {
  const $ = loadHtml(html);
  const htmlEl = $("html");

  const pageId = htmlEl.attr("data-wf-page");
  const siteId = htmlEl.attr("data-wf-site");
  const collectionKey = htmlEl.attr("data-wf-collection");
  const slug = htmlEl.attr("data-wf-item-slug");
  const localeId = htmlEl.attr("lang");

  return {
    isWebflow: pageId !== undefined && siteId !== undefined,
    kind: collectionKey !== undefined ? "item" : "static",
    ...(collectionKey !== undefined && { collectionKey }),
    ...(slug !== undefined && { slug }),
    ...(pageId !== undefined && { pageId }),
    ...(localeId !== undefined && { localeId }),
  };
}
