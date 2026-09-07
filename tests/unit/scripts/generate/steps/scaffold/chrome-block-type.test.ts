import { globalDefSchema } from "#ir/globals.ts";
import { chromeBlockTypeFor } from "#generate/steps/scaffold/chrome-block-type.ts";
import { emitBlockProps } from "#blocks/codegen/props.ts";

const header = globalDefSchema.parse({
  name: "header",
  fields: [
    { name: "logo", type: { type: "image" }, required: true },
    {
      name: "navItems",
      type: {
        type: "array",
        element: {
          type: "group",
          fields: [
            { name: "label", type: { type: "text" }, required: true },
            { name: "url", type: { type: "url" }, required: true },
          ],
        },
      },
      required: true,
    },
  ],
  values: {
    logo: { assetId: "a1f2a3b4c5d6e7f8", alt: "Acme" },
    navItems: [{ label: "About", url: "/about" }],
  },
});

describe("chromeBlockTypeFor", () => {
  it("builds a synthetic BlockType so emitBlockProps produces the chrome props interface", () => {
    const block = chromeBlockTypeFor(header);
    expect(String(block.id)).toBe("global-header");
    const props = emitBlockProps(block);
    expect(props).toContain("export interface GlobalHeaderProps");
    expect(props).toContain("logo: MediaProp;");
    expect(props).not.toContain("docs?");
  });
});
