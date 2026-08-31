import { buildPagesData, type ClassifiedPage } from "#adapters/shared/pages.ts";
import { pagesDataSchema } from "#ir/pages.ts";

describe("buildPagesData", () => {
  it("merges the same route seen by sitemap and crawl into one page with sources in rank order", () => {
    const input: ClassifiedPage[] = [
      { route: "/about", kind: "static", source: "crawl" },
      { route: "/about", kind: "static", source: "sitemap" },
    ];

    const result = buildPagesData(input);

    expect(result.pages).toEqual([{ route: "/about", kind: "static", sources: ["sitemap", "crawl"] }]);
  });

  it("orders sources sitemap < crawl < searchindex regardless of input order", () => {
    const input: ClassifiedPage[] = [
      { route: "/about", kind: "static", source: "searchindex" },
      { route: "/about", kind: "static", source: "crawl" },
      { route: "/about", kind: "static", source: "sitemap" },
    ];

    const result = buildPagesData(input);

    expect(result.pages[0]?.sources).toEqual(["sitemap", "crawl", "searchindex"]);
  });

  it("groups three item pages under one collection with itemCount 3", () => {
    const input: ClassifiedPage[] = [
      {
        route: "/works/a",
        kind: "item",
        collectionKey: "works",
        slug: "a",
        source: "crawl",
      },
      {
        route: "/works/b",
        kind: "item",
        collectionKey: "works",
        slug: "b",
        source: "crawl",
      },
      {
        route: "/works/c",
        kind: "item",
        collectionKey: "works",
        slug: "c",
        source: "crawl",
      },
    ];

    const result = buildPagesData(input);

    expect(result.pages).toHaveLength(3);
    expect(result.collections).toEqual([{ key: "works", routePattern: "/works/:slug", itemCount: 3 }]);
  });

  it("derives a single-segment routePattern for a top-level item route", () => {
    const input: ClassifiedPage[] = [
      {
        route: "/foo",
        kind: "item",
        collectionKey: "foo-collection",
        source: "crawl",
      },
    ];

    const result = buildPagesData(input);

    expect(result.collections).toEqual([{ key: "foo-collection", routePattern: "/:slug", itemCount: 1 }]);
  });

  it("produces no collection entries for static pages", () => {
    const input: ClassifiedPage[] = [
      { route: "/", kind: "static", source: "sitemap" },
      { route: "/about", kind: "static", source: "sitemap" },
    ];

    const result = buildPagesData(input);

    expect(result.collections).toEqual([]);
  });

  it('preserves the root route "/"', () => {
    const input: ClassifiedPage[] = [{ route: "/", kind: "static", source: "sitemap" }];

    const result = buildPagesData(input);

    expect(result.pages).toEqual([{ route: "/", kind: "static", sources: ["sitemap"] }]);
  });

  it("omits optional fields entirely rather than setting them to undefined", () => {
    const input: ClassifiedPage[] = [{ route: "/", kind: "static", source: "sitemap" }];

    const result = buildPagesData(input);
    const [page] = result.pages;

    expect(page).toBeDefined();
    expect("collectionKey" in (page ?? {})).toBe(false);
    expect("slug" in (page ?? {})).toBe(false);
    expect("localeId" in (page ?? {})).toBe(false);
  });

  it("takes the first defined collectionKey/slug/localeId across the group", () => {
    const input: ClassifiedPage[] = [
      { route: "/works/a", kind: "item", source: "crawl" },
      {
        route: "/works/a",
        kind: "item",
        collectionKey: "works",
        slug: "a",
        localeId: "en",
        source: "sitemap",
      },
    ];

    const result = buildPagesData(input);

    expect(result.pages[0]).toEqual({
      route: "/works/a",
      kind: "item",
      collectionKey: "works",
      slug: "a",
      localeId: "en",
      sources: ["sitemap", "crawl"],
    });
  });

  it("does not let a later record override an already-defined field", () => {
    const input: ClassifiedPage[] = [
      { route: "/works/a", kind: "item", collectionKey: "aaa", source: "crawl" },
      { route: "/works/a", kind: "item", collectionKey: "bbb", source: "sitemap" },
    ];

    const result = buildPagesData(input);

    expect(result.pages[0]?.collectionKey).toBe("aaa");
  });

  it("sorts pages by route using localeCompare", () => {
    const input: ClassifiedPage[] = [
      { route: "/zeta", kind: "static", source: "sitemap" },
      { route: "/", kind: "static", source: "sitemap" },
      { route: "/alpha", kind: "static", source: "sitemap" },
    ];

    const result = buildPagesData(input);

    expect(result.pages.map((page) => page.route)).toEqual(["/", "/alpha", "/zeta"]);
  });

  it("sorts collections by key using localeCompare", () => {
    const input: ClassifiedPage[] = [
      {
        route: "/zeta/a",
        kind: "item",
        collectionKey: "zeta",
        source: "sitemap",
      },
      {
        route: "/alpha/a",
        kind: "item",
        collectionKey: "alpha",
        source: "sitemap",
      },
    ];

    const result = buildPagesData(input);

    expect(result.collections.map((collection) => collection.key)).toEqual(["alpha", "zeta"]);
  });

  it("produces identical output regardless of input order (deterministic)", () => {
    const input: ClassifiedPage[] = [
      { route: "/about", kind: "static", source: "crawl" },
      { route: "/about", kind: "static", source: "sitemap" },
      { route: "/", kind: "static", source: "sitemap" },
      {
        route: "/works/a",
        kind: "item",
        collectionKey: "works",
        slug: "a",
        source: "crawl",
      },
      {
        route: "/works/b",
        kind: "item",
        collectionKey: "works",
        slug: "b",
        source: "crawl",
      },
      {
        route: "/works/c",
        kind: "item",
        collectionKey: "works",
        slug: "c",
        source: "searchindex",
      },
    ];
    const shuffled = [...input].reverse();

    const resultFromOriginal = buildPagesData(input);
    const resultFromShuffled = buildPagesData(shuffled);

    expect(resultFromShuffled).toEqual(resultFromOriginal);
  });

  it("produces output that satisfies pagesDataSchema", () => {
    const input: ClassifiedPage[] = [
      { route: "/", kind: "static", source: "sitemap" },
      {
        route: "/works/a",
        kind: "item",
        collectionKey: "works",
        slug: "a",
        localeId: "en",
        source: "crawl",
      },
    ];

    const result = buildPagesData(input);

    expect(() => pagesDataSchema.parse(result)).not.toThrow();
  });
});
