import { blockTypeSchema } from "#ir/blocks.ts";
import { contentFieldPaths, emitExtractPageContentFile } from "#generate/codegen/extract-page-content.ts";

const hero = blockTypeSchema.parse({
  id: "hero",
  name: "Hero",
  content: {},
  fields: [
    { name: "heading", type: { type: "text" }, required: true },
    { name: "body", type: { type: "richText" }, required: false },
    { name: "image", type: { type: "image" }, required: false },
    { name: "ctaHref", type: { type: "url" }, required: false },
    { name: "columns", type: { type: "number" }, required: false },
  ],
});

describe("contentFieldPaths", () => {
  it("keeps the content-bearing scalars and drops the rest", () => {
    expect(contentFieldPaths(hero.fields)).toEqual([
      { kind: "text", path: ["heading"] },
      { kind: "richText", path: ["body"] },
      { kind: "upload", path: ["image"] },
    ]);
  });

  // Array rows are seeded as { item: value }, so a nested path addresses the row's item and the
  // runtime walker unwraps it — the emitted path itself never names `item`.
  it("walks into groups and array elements", () => {
    const faq = blockTypeSchema.parse({
      id: "faq",
      name: "Faq",
      content: {},
      fields: [
        {
          name: "items",
          required: true,
          type: {
            type: "array",
            element: {
              type: "group",
              fields: [
                { name: "question", type: { type: "text" }, required: true },
                { name: "answer", type: { type: "richText" }, required: false },
              ],
            },
          },
        },
        { name: "tags", type: { type: "array", element: { type: "text" } }, required: false },
      ],
    });

    expect(contentFieldPaths(faq.fields)).toEqual([
      { kind: "text", path: ["items", "question"] },
      { kind: "richText", path: ["items", "answer"] },
      { kind: "text", path: ["tags"] },
    ]);
  });
});

describe("emitExtractPageContentFile", () => {
  it("emits the per-block spec and keeps the globalSectionSlot indirection", () => {
    const source = emitExtractPageContentFile({ blocks: [hero] });

    expect(source).toContain('"hero": [');
    expect(source).toContain('{ kind: "upload", path: ["image"] }');
    expect(source).toContain('blockType === "globalSectionSlot"');
    expect(source).toContain("export default extractPageContent");
  });
});
