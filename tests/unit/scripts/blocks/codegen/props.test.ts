import { emitBlockProps } from "#blocks/codegen/props.ts";
import { blockTypeSchema } from "#ir/blocks.ts";

const block = blockTypeSchema.parse({
  id: "feature-grid",
  name: "Feature Grid",
  content: {},
  fields: [
    { name: "heading", type: { type: "text" }, required: true },
    { name: "cover", type: { type: "image" }, required: false },
    { name: "clip", type: { type: "video" }, required: false },
    { name: "align", type: { type: "option", values: ["left", "center"] }, required: true },
    { name: "related", type: { type: "multiReference", collectionKey: "posts" }, required: false },
    {
      name: "items",
      type: {
        type: "array",
        element: { type: "group", fields: [{ name: "label", type: { type: "text" }, required: true }] },
      },
      required: true,
    },
  ],
});

describe("emitBlockProps", () => {
  it("emits a TS props interface", () => {
    const out = emitBlockProps(block);
    expect(out).toContain("export interface FeatureGridProps {");
    expect(out).toContain("heading: string;");
    expect(out).toContain("cover?: MediaProp;");
    expect(out).toContain("clip?: MediaProp;");
    expect(out).toContain('align: "left" | "center";');
    expect(out).toContain("related?: ({ id: string } & Record<string, unknown>)[];");
    expect(out).toContain("items: { label: string }[];");
    expect(out).toContain("export interface MediaProp");
    expect(out).toMatchInlineSnapshot(`
      "export interface MediaProp {
        src: string;
        alt?: string;
      }

      export interface FeatureGridProps {
        heading: string;
        cover?: MediaProp;
        clip?: MediaProp;
        align: "left" | "center";
        related?: ({ id: string } & Record<string, unknown>)[];
        items: { label: string }[];
      }
      "
    `);
  });

  describe("richText", () => {
    const richBlock = blockTypeSchema.parse({
      id: "hero",
      name: "Hero",
      content: {},
      fields: [{ name: "body", type: { type: "richText" }, required: true }],
    });
    const src = emitBlockProps(richBlock);

    it("types richText props as RichTextData", () => {
      expect(src).toContain("body: RichTextData;");
    });
    it("inlines the RichTextData type from the bare lexical specifier (verify-safe)", () => {
      expect(src).toContain('import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";');
      expect(src).toContain("type RichTextData = SerializedEditorState;");
    });
    it("omits the type when no field uses richText", () => {
      expect(emitBlockProps(block)).not.toContain("RichTextData");
    });
  });

  it("types a reference field as the resolved document, not a bare id string", () => {
    const refBlock = blockTypeSchema.parse({
      id: "profile-card",
      name: "Profile Card",
      content: {},
      fields: [{ name: "author", type: { type: "reference", collectionKey: "people" }, required: true }],
    });
    expect(emitBlockProps(refBlock)).toContain("author: { id: string } & Record<string, unknown>;");
  });

  it("adds the docs prop only for collection-list blocks", () => {
    const base = {
      id: "works-grid",
      name: "Works grid",
      content: {},
      fields: [{ name: "limit", type: { type: "number" }, required: false }],
    };
    const listBlock = blockTypeSchema.parse({ ...base, collectionKey: "works" });
    const plainBlock = blockTypeSchema.parse(base);
    expect(emitBlockProps(listBlock)).toContain("docs?: ({ id: string } & Record<string, unknown>)[]");
    expect(emitBlockProps(plainBlock)).not.toContain("docs?");
  });
});
