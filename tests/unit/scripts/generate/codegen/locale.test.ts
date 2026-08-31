import { resolveLocaleCode } from "#generate/codegen/locale.ts";

const page = (route: string, localeId?: string) => ({
  route,
  kind: "static" as const,
  sources: ["sitemap" as const],
  ...(localeId === undefined ? {} : { localeId }),
});

describe("resolveLocaleCode", () => {
  it("takes the most frequent localeId", () => {
    const pages = { pages: [page("/", "de"), page("/a", "de"), page("/b", "fr")], collections: [] };
    expect(resolveLocaleCode(pages)).toBe("de");
  });

  it("normalizes a regional tag to its language subtag", () => {
    const pages = { pages: [page("/", "en-US")], collections: [] };
    expect(resolveLocaleCode(pages)).toBe("en");
  });

  it("falls back to en when no page carries a localeId", () => {
    const pages = { pages: [page("/")], collections: [] };
    expect(resolveLocaleCode(pages)).toBe("en");
  });

  // Webflow's localeId is an <html lang> tag, but a captured page can carry an internal id
  // instead, such as "default" or "deLocaleId". Neither is a language tag, and payload would
  // accept either as a locale code.
  it("ignores a localeId that is not a language tag", () => {
    const pages = { pages: [page("/", "default"), page("/a", "deLocaleId")], collections: [] };
    expect(resolveLocaleCode(pages)).toBe("en");
  });

  it("lets a real tag win even when a non-tag id is more frequent", () => {
    const pages = {
      pages: [page("/", "default"), page("/a", "default"), page("/b", "de")],
      collections: [],
    };
    expect(resolveLocaleCode(pages)).toBe("de");
  });

  it("keeps accepting the tag shapes a site may legitimately carry", () => {
    expect(resolveLocaleCode({ pages: [page("/", "pt-BR")], collections: [] })).toBe("pt");
    expect(resolveLocaleCode({ pages: [page("/", "zh-Hans-CN")], collections: [] })).toBe("zh");
    expect(resolveLocaleCode({ pages: [page("/", "EN")], collections: [] })).toBe("en");
  });
});
