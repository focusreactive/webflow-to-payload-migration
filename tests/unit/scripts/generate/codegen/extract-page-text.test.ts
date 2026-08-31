import { blockTypeSchema } from "#ir/blocks.ts";
import { emitExtractPageTextFile } from "#generate/codegen/extract-page-text.ts";

describe("emitExtractPageTextFile", () => {
  it("lists the text-bearing field slugs per block type", () => {
    const blocks = {
      blocks: [
        blockTypeSchema.parse({
          id: "hero",
          name: "Hero",
          content: {},
          fields: [
            { name: "heading", type: { type: "text" }, required: true },
            { name: "body", type: { type: "richText" }, required: false },
            { name: "image", type: { type: "image" }, required: false },
          ],
        }),
      ],
    };

    const source = emitExtractPageTextFile(blocks);

    expect(source).toContain('hero: ["heading", "body"]');
    expect(source).not.toContain("image");
  });
});
