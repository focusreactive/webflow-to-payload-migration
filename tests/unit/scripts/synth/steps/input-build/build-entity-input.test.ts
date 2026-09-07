import type { CollectionId } from "#ir/common.ts";
import { buildEntityInput } from "#synth/steps/input-build/build-entity-input.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unstubbedResolveDoc(): never {
  throw new Error("resolveDoc is not stubbed in this test");
}

describe("buildEntityInput", () => {
  it("passes plain text fields through untouched", async () => {
    const result = await buildEntityInput({
      fields: [{ name: "heading", label: "Heading", type: { type: "text" }, required: true }],
      literals: { heading: "Title" },
      resolveAssetSrc: () => undefined,
      resolveDoc: unstubbedResolveDoc,
    });
    expect(result).toEqual({ heading: "Title" });
  });

  it("turns an image field into a ready-to-render src and alt", async () => {
    const result = await buildEntityInput({
      fields: [{ name: "image", label: "Image", type: { type: "image" }, required: true }],
      literals: { image: { assetId: "a1", alt: "Shot" } },
      resolveAssetSrc: (assetId) => (assetId === "a1" ? "/media/a1.png" : undefined),
      resolveDoc: unstubbedResolveDoc,
    });
    expect(result).toEqual({ image: { src: "/media/a1.png", alt: "Shot" } });
  });

  it("leaves an unresolved asset without a real src rather than inventing one", async () => {
    const result = await buildEntityInput({
      fields: [{ name: "image", label: "Image", type: { type: "image" }, required: true }],
      literals: { image: { assetId: "missing", alt: "Shot" } },
      resolveAssetSrc: () => undefined,
      resolveDoc: unstubbedResolveDoc,
    });
    const image = result["image"];
    expect(isRecord(image)).toBe(true);
    if (!isRecord(image)) throw new Error("expected the image field to resolve to a record");
    expect(image["src"]).toBe("");
  });

  it("resolves a reference field into the referenced document, not the id it was stored as", async () => {
    const teamKey = "team-key" as CollectionId;
    const author = { id: "wilson-tomales", _provenance: "ai" as const, name: "Wilson Tomales" };
    const result = await buildEntityInput({
      fields: [
        { name: "author", label: "Author", type: { type: "reference", collectionKey: teamKey }, required: true },
      ],
      literals: { author: "wilson-tomales" },
      resolveAssetSrc: () => undefined,
      resolveDoc: (collectionKey, id) => {
        expect(collectionKey).toBe(teamKey);
        expect(id).toBe("wilson-tomales");
        return author;
      },
    });
    expect(result).toEqual({ author });
  });

  it("resolves a multiReference field into an array of referenced documents", async () => {
    const postKey = "post-key" as CollectionId;
    const posts = [
      { id: "post-a", _provenance: "ai" as const, title: "Post A" },
      { id: "post-b", _provenance: "ai" as const, title: "Post B" },
    ];
    const result = await buildEntityInput({
      fields: [
        {
          name: "relatedPosts",
          label: "Related posts",
          type: { type: "multiReference", collectionKey: postKey },
          required: false,
        },
      ],
      literals: { relatedPosts: ["post-a", "post-b"] },
      resolveAssetSrc: () => undefined,
      resolveDoc: (collectionKey, id) => {
        expect(collectionKey).toBe(postKey);
        const post = posts.find((candidate) => candidate.id === id);
        if (post === undefined) throw new Error(`unexpected id ${id}`);
        return post;
      },
    });
    expect(result).toEqual({ relatedPosts: posts });
  });
});
