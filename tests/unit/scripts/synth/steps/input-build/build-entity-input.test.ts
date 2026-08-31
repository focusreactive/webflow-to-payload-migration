import { buildEntityInput } from "#synth/steps/input-build/build-entity-input.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

describe("buildEntityInput", () => {
  it("passes plain text fields through untouched", async () => {
    const result = await buildEntityInput({
      fields: [{ name: "heading", label: "Heading", type: { type: "text" }, required: true }],
      literals: { heading: "Title" },
      resolveAssetSrc: () => undefined,
    });
    expect(result).toEqual({ heading: "Title" });
  });

  it("turns an image field into a ready-to-render src and alt", async () => {
    const result = await buildEntityInput({
      fields: [{ name: "image", label: "Image", type: { type: "image" }, required: true }],
      literals: { image: { assetId: "a1", alt: "Shot" } },
      resolveAssetSrc: (assetId) => (assetId === "a1" ? "/media/a1.png" : undefined),
    });
    expect(result).toEqual({ image: { src: "/media/a1.png", alt: "Shot" } });
  });

  it("leaves an unresolved asset without a real src rather than inventing one", async () => {
    const result = await buildEntityInput({
      fields: [{ name: "image", label: "Image", type: { type: "image" }, required: true }],
      literals: { image: { assetId: "missing", alt: "Shot" } },
      resolveAssetSrc: () => undefined,
    });
    const image = result["image"];
    expect(isRecord(image)).toBe(true);
    if (!isRecord(image)) throw new Error("expected the image field to resolve to a record");
    expect(image["src"]).toBe("");
  });
});
