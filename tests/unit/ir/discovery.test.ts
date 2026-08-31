import {
  blocksShardArtifactFor,
  discoveryBlocksArtifact,
  discoveryBlocksDataSchema,
  discoveryCollectionsDataSchema,
} from "#ir/discovery.ts";

const INSTANCE = {
  route: "/",
  nodeIds: ["mig-7"],
  role: "hero",
  summary: "hero band",
  boundaries: { desktop: { rect: { x: 0, y: 0, width: 1440, height: 600 } } },
};

describe("discovery blocks inventory", () => {
  it("round-trips types and rejects unknown keys", () => {
    const data = {
      types: [
        {
          id: "hero",
          name: "Hero",
          role: "hero",
          exemplar: { route: "/", nodeIds: ["mig-7", "mig-8"] },
        },
      ],
    };
    expect(discoveryBlocksDataSchema.parse(data)).toEqual(data);
    expect(() => discoveryBlocksDataSchema.parse({ ...data, extra: 1 })).toThrow();
    expect(() => discoveryBlocksDataSchema.parse({ ...data, instances: [] })).toThrow();
  });

  it("requires at least one nodeId per shard instance", () => {
    expect(() =>
      blocksShardArtifactFor("home").dataSchema.parse({ route: "/", instances: [{ ...INSTANCE, nodeIds: [] }] }),
    ).toThrow();
  });

  it("shard path is per-route under discovery/blocks/", () => {
    expect(blocksShardArtifactFor("about").relativePath).toBe("discovery/blocks/about.json");
    expect(discoveryBlocksArtifact.relativePath).toBe("discovery/blocks.json");
  });
});

describe("discovery collections inventory", () => {
  it("round-trips collection types carrying sections", () => {
    const collectionsData = discoveryCollectionsDataSchema.parse({
      types: [
        {
          collectionKey: "blog",
          representativeItem: { route: "/blog/a", slug: "a" },
          sections: [
            {
              id: "hero",
              role: "hero",
              summary: "post hero",
              nodeIds: ["mig-4"],
              boundaries: { desktop: { rect: { x: 0, y: 0, width: 1440, height: 500 } } },
            },
          ],
        },
      ],
    });
    expect(collectionsData.types[0]?.sections[0]?.id).toBe("hero");
  });

  it("defaults sections to an empty array when omitted", () => {
    const collectionsData = discoveryCollectionsDataSchema.parse({
      types: [{ collectionKey: "blog", representativeItem: { route: "/blog/a", slug: "a" } }],
    });
    expect(collectionsData.types[0]?.sections).toEqual([]);
  });
});
