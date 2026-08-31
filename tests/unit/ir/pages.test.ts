import { pagesArtifact, pagesDataSchema, type PagesData } from "#ir/pages.ts";

const validData: PagesData = {
  pages: [
    {
      route: "/",
      kind: "static",
      sources: ["sitemap"],
    },
    {
      route: "/works/:slug",
      kind: "item",
      collectionKey: "works",
      slug: "my-project",
      localeId: "en",
      sources: ["crawl", "searchindex"],
    },
  ],
  collections: [
    {
      key: "works",
      routePattern: "/works/:slug",
      itemCount: 12,
    },
  ],
};

describe("pagesDataSchema", () => {
  it("parses a valid PagesData object", () => {
    expect(pagesDataSchema.parse(validData)).toEqual(validData);
  });

  it("round-trips through JSON", () => {
    const roundTripped = pagesDataSchema.parse(JSON.parse(JSON.stringify(validData)));

    expect(roundTripped).toEqual(validData);
  });

  it("rejects an unknown key at the top level", () => {
    expect(() => pagesDataSchema.parse({ ...validData, extra: "nope" })).toThrow();
  });

  it("rejects an unknown key on a page record", () => {
    expect(() =>
      pagesDataSchema.parse({
        ...validData,
        pages: [{ ...validData.pages[0], bogus: "nope" }],
      }),
    ).toThrow();
  });

  it("rejects a page record with an empty sources array", () => {
    expect(() =>
      pagesDataSchema.parse({
        ...validData,
        pages: [{ ...validData.pages[0], sources: [] }],
      }),
    ).toThrow();
  });
});

describe("pagesArtifact", () => {
  it("matches the ArtifactDef contract for the pages kind", () => {
    expect(pagesArtifact.kind).toBe("pages");
    expect(pagesArtifact.relativePath).toBe("pages.json");
    expect(pagesArtifact.schemaVersion).toBe(1);
    expect(pagesArtifact.dataSchema).toBe(pagesDataSchema);
  });
});
