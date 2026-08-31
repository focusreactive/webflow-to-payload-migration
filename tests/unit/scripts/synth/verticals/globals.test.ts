import type { GlobalField } from "#ir/globals.ts";
import { globalContentResponseSchema } from "#synth/schemas/content-response.ts";

const fields: GlobalField[] = [
  { name: "logo", type: { type: "image" }, required: true },
  { name: "tagline", type: { type: "text" }, required: false },
  {
    name: "nav",
    type: {
      type: "array",
      element: {
        type: "group",
        fields: [
          { name: "label", type: { type: "text" }, required: true },
          { name: "href", type: { type: "text" }, required: false },
        ],
      },
    },
    required: true,
  },
];

function valuesOf(response: unknown): unknown {
  const parsed = globalContentResponseSchema(fields).safeParse(response);
  if (!parsed.success) throw new Error(`the content response was rejected: ${parsed.error.message}`);
  return (parsed.data as { values: unknown }).values;
}

describe("globalContentResponseSchema", () => {
  it("validates values against the global's fields", () => {
    expect(valuesOf({ values: { logo: { assetId: "a1" }, nav: [{ label: "Docs", href: "/docs" }] } })).toEqual({
      logo: { assetId: "a1" },
      nav: [{ label: "Docs", href: "/docs" }],
    });
  });

  it("accepts the AI's null-for-absent dialect, including inside array<group>", () => {
    expect(
      valuesOf({
        values: { logo: { assetId: "a1", alt: null }, tagline: null, nav: [{ label: "Docs", href: null }] },
      }),
    ).toEqual({ logo: { assetId: "a1" }, nav: [{ label: "Docs" }] });
  });

  it("rejects a null in a required position nested in an array<group>", () => {
    const parsed = globalContentResponseSchema(fields).safeParse({
      values: { logo: { assetId: "a1" }, nav: [{ label: null }] },
    });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toMatch(/label/);
  });
});
