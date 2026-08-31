import { foldBlocks } from "#synth/verticals/utils/fold-blocks.ts";

describe("foldBlocks", () => {
  it("assembles per-entity schema + content shards into blocks.json with content", () => {
    const data = foldBlocks(
      [
        {
          key: "hero",
          schema: {
            name: "Hero",
            fields: [{ name: "heading", type: { type: "text" }, required: true }],
            collectionKey: "blog",
          },
          content: { literals: { heading: "Welcome" } },
        },
      ],
      ["blog"],
    );
    expect(data.blocks[0]?.id).toBe("hero");
    expect(data.blocks[0]?.name).toBe("Hero");
    expect(data.blocks[0]?.fields).toEqual([{ name: "heading", type: { type: "text" }, required: true }]);
    expect(data.blocks[0]?.collectionKey).toBe("blog");
    expect(data.blocks[0]?.content).toEqual({ heading: "Welcome" });
  });

  it("throws when a block's collectionKey is not in validCollectionKeys", () => {
    expect(() =>
      foldBlocks(
        [
          {
            key: "hero",
            schema: { name: "Hero", fields: [], collectionKey: "ghost" },
            content: { literals: {} },
          },
        ],
        ["blog"],
      ),
    ).toThrow(/collectionKey/);
  });
});
