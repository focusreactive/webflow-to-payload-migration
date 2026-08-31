import { type PagesData } from "#ir/pages.ts";

const FALLBACK_LOCALE = "en";

// Webflow's localeId is an <html lang> tag, but a captured page can carry an internal id
// instead ("default", "deLocaleId"). Payload accepts any string as a locale code, so a non-tag
// value would silently become the site's locale, <html lang> and og:locale. Anything that is
// not shaped like a language tag falls through to the fallback.
const LANGUAGE_TAG = /^[a-z]{2,3}([-_][a-z0-9]{2,8})*$/i;

const LOCALE_LABELS: Record<string, string> = {
  de: "German",
  en: "English",
  es: "Spanish",
  fr: "French",
  it: "Italian",
  nl: "Dutch",
  pl: "Polish",
  pt: "Portuguese",
};

const OPEN_GRAPH_LOCALES: Record<string, string> = {
  de: "de_DE",
  en: "en_US",
  es: "es_ES",
  fr: "fr_FR",
  it: "it_IT",
  nl: "nl_NL",
  pl: "pl_PL",
  pt: "pt_PT",
};

export function resolveLocaleCode(pages: PagesData): string {
  const counts = new Map<string, number>();
  for (const page of pages.pages) {
    const raw = page.localeId;
    if (raw === undefined || !LANGUAGE_TAG.test(raw)) continue;
    const language = raw.toLowerCase().split(/[-_]/)[0];
    if (language === undefined) continue;
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b));
  return ranked[0]?.[0] ?? FALLBACK_LOCALE;
}

export function localeLabel(code: string): string {
  return LOCALE_LABELS[code] ?? code.toUpperCase();
}

export function openGraphLocale(code: string): string {
  return OPEN_GRAPH_LOCALES[code] ?? `${code}_${code.toUpperCase()}`;
}
