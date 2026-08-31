import { emitBlockConfig } from "#blocks/codegen/config.ts";
import { blockComponentName } from "#blocks/codegen/names.ts";
import { blockTypeSchema } from "#ir/blocks.ts";

const block = blockTypeSchema.parse({
  id: "feature-grid",
  name: "Feature Grid",
  content: {},
  fields: [
    { name: "heading", type: { type: "text" }, required: true },
    { name: "cover", type: { type: "image" }, required: false },
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

describe("blockComponentName", () => {
  it("PascalCases a slug id", () => {
    expect(blockComponentName("feature-grid" as never)).toBe("FeatureGrid");
  });
});

describe("emitBlockConfig", () => {
  it("emits a valid Payload block config", () => {
    const out = emitBlockConfig(block);
    expect(out).toContain('import type { Block } from "payload"');
    expect(out).toContain('slug: "feature-grid"');
    expect(out).toContain('interfaceName: "FeatureGridBlock"');
    expect(out).toContain('labels: { singular: "Feature Grid", plural: "Feature Grid" }');
    expect(out).toContain('"type": "relationship"');
    expect(out).toContain('"relationTo": "posts"');
    expect(out).toContain('"hasMany": true');
    expect(out).toContain('"type": "select"');
    expect(out).toContain('"type": "array"');
    expect(out).toContain('"type": "upload"');
    expect(out).not.toContain("imageURL");
    expect(out).toMatchInlineSnapshot(`
      "import type { Block } from "payload";

      export const FeatureGrid: Block = {
        slug: "feature-grid",
        interfaceName: "FeatureGridBlock",
        labels: { singular: "Feature Grid", plural: "Feature Grid" },
        fields: [
          {
            "name": "heading",
            "type": "text",
            "required": true
          },
          {
            "name": "cover",
            "type": "upload",
            "relationTo": "media"
          },
          {
            "name": "align",
            "type": "select",
            "options": [
              {
                "label": "left",
                "value": "left"
              },
              {
                "label": "center",
                "value": "center"
              }
            ],
            "required": true
          },
          {
            "name": "related",
            "type": "relationship",
            "relationTo": "posts",
            "hasMany": true
          },
          {
            "name": "items",
            "type": "array",
            "fields": [
              {
                "name": "item",
                "type": "group",
                "fields": [
                  {
                    "name": "label",
                    "type": "text",
                    "required": true
                  }
                ]
              }
            ],
            "required": true
          }
        ],
      };
      "
    `);
  });

  it("points the admin block picker at the block's verified preview frame", () => {
    const out = emitBlockConfig(block, (key) => key, "/block-preview-images/feature-grid.png");

    expect(out).toContain('imageURL: "/block-preview-images/feature-grid.png"');
    expect(out).toContain('imageAltText: "Feature Grid block preview"');
  });
});
