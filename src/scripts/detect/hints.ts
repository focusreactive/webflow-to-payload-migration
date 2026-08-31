import type { ProbeView } from "#detect/probe-view.ts";
import { type PlatformHints } from "#ir/detect.ts";

export function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const WF_SITE_RE = /data-wf-site=["']([^"']*)["']/i;
const WF_PAGE_RE = /data-wf-page=["']([^"']*)["']/i;
const WF_DOMAIN_RE = /data-wf-domain=["']([^"']*)["']/i;

function extractAttr(re: RegExp, source: string): string | undefined {
  return re.exec(source)?.[1];
}

export function extractPlatformHints(view: ProbeView): PlatformHints {
  const webflowSiteId = extractAttr(WF_SITE_RE, view.htmlTag);
  const webflowPageId = extractAttr(WF_PAGE_RE, view.htmlTag);
  const webflowDomain = extractAttr(WF_DOMAIN_RE, view.htmlTag);

  return {
    ...(webflowSiteId !== undefined && { webflowSiteId }),
    ...(webflowPageId !== undefined && { webflowPageId }),
    ...(webflowDomain !== undefined && { webflowDomain }),
  };
}
