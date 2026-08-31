import { foldCollections } from "#synth/verticals/utils/fold-collections.ts";

describe("foldCollections", () => {
  it("assembles per-entity schema + content shards into collections.json", () => {
    const data = foldCollections([
      {
        key: "blog",
        schema: {
          label: "Blog",
          fields: [{ name: "title", type: { type: "text" }, required: true }],
          pageBinding: { slugField: "title", meta: { title: "title" } },
        },
        content: { items: [{ id: "hi", _provenance: "ai", title: "Hi" }] },
        template: [{ sectionId: "hero", itemFields: ["title"] }],
      },
    ]);
    expect(data.collections[0]?.key).toBe("blog");
    expect(data.collections[0]?.items[0]?.id).toBe("hi");
    expect(data.collections[0]?.template).toEqual([{ sectionId: "hero", itemFields: ["title"] }]);
  });

  it("throws when a shard's pageBinding is invalid", () => {
    expect(() =>
      foldCollections([
        {
          key: "blog",
          schema: {
            label: "Blog",
            fields: [{ name: "title", type: { type: "text" }, required: true }],
            pageBinding: { slugField: "ghost", meta: {} },
          },
          content: { items: [] },
          template: [],
        },
      ]),
    ).toThrow(/slugField/);
  });
});
