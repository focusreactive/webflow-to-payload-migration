import type { ProbeData } from "#probe/read-probe-data.ts";

export const PROBE_VIEW_PREFIX_BYTES = 65_536;

export interface ProbeView {
  htmlTag: string;
  head: string;
  prefix: string;
  body: string;
  fullHtml: string;
  headers: Record<string, string>;
  finalUrl: string;
  redirectChain: string[];
  sourceUrl: string;
  robotsTxt?: string;
  sitemapXml?: string;
  notFound?: { html: string; status: number };
}

const HTML_TAG_RE = /<html\b[^>]*>/i;
const HEAD_RE = /<head\b[^>]*>([\s\S]*?)<\/head>/i;
const BODY_RE = /<body\b[^>]*>([\s\S]*?)<\/body>/i;

export function buildProbeView(data: ProbeData): ProbeView {
  const fullHtml = data.homeHtml;

  return {
    htmlTag: HTML_TAG_RE.exec(fullHtml)?.[0] ?? "",
    head: HEAD_RE.exec(fullHtml)?.[1] ?? "",
    prefix: fullHtml.slice(0, PROBE_VIEW_PREFIX_BYTES),
    body: BODY_RE.exec(fullHtml)?.[1] ?? fullHtml,
    fullHtml,
    headers: data.homeHttp.headers,
    finalUrl: data.homeHttp.finalUrl,
    redirectChain: data.homeHttp.redirectChain,
    sourceUrl: data.sourceUrl,
    ...(data.robotsTxt !== undefined && { robotsTxt: data.robotsTxt }),
    ...(data.sitemapXml !== undefined && { sitemapXml: data.sitemapXml }),
    ...(data.notFound !== undefined && { notFound: data.notFound }),
  };
}
