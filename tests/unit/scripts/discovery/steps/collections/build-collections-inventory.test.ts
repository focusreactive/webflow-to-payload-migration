import { buildCollectionsInventory } from "#discovery/steps/collections/build-collections-inventory.ts";

const pages = {
  pages: [
    { route: "/", kind: "static" },
    { route: "/blog/a", kind: "item", collectionKey: "blog", slug: "a" },
    { route: "/blog/b", kind: "item", collectionKey: "blog", slug: "b" },
  ],
} as never;

describe("buildCollectionsInventory", () => {
  it("emits ordered sections from the representative item route's shard, minting unique ids", () => {
    const shard = {
      route: "/blog/a",
      instances: [
        {
          route: "/blog/a",
          nodeIds: ["mig-9"],
          role: "cta",
          summary: "",
          boundaries: { desktop: { rect: { x: 0, y: 900, width: 400, height: 100 } } },
        },
        {
          route: "/blog/a",
          nodeIds: ["mig-2"],
          role: "hero",
          summary: "",
          boundaries: { desktop: { rect: { x: 0, y: 0, width: 400, height: 300 } } },
        },
        {
          route: "/blog/a",
          nodeIds: ["mig-5"],
          role: "hero",
          summary: "",
          boundaries: { desktop: { rect: { x: 0, y: 400, width: 400, height: 300 } } },
        },
      ],
    } as never;
    const data = buildCollectionsInventory({ pages, shardFor: (route) => (route === "/blog/a" ? shard : undefined) });
    expect(data.types[0]?.sections.map((section) => section.id)).toEqual(["hero", "hero-2", "cta"]);
  });

  it("emits empty sections when the shard is missing", () => {
    const data = buildCollectionsInventory({ pages, shardFor: () => undefined });
    expect(data.types[0]?.sections).toEqual([]);
  });
});
