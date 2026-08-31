import type { Signal, SignalHit } from "#detect/types.ts";

const EVIDENCE_MAX = 160;

export function truncate(value: string, max = EVIDENCE_MAX): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max)}…`;
}

export function hit(evidence: string): SignalHit {
  return { evidence: truncate(evidence) };
}

export function firstMatch(re: RegExp, text: string): string | null {
  const m = re.exec(text);
  return m?.[0] ?? null;
}

export function countMatches(re: RegExp, text: string): number {
  return text.match(re)?.length ?? 0;
}

export function hostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

type Region = "htmlTag" | "head" | "body" | "fullHtml";

export function inRegion(region: Region, re: RegExp): Signal["match"] {
  return (view) => {
    const found = firstMatch(re, view[region]);
    return found ? hit(found) : null;
  };
}
