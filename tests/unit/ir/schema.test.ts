import { collectionSchema } from "#ir/schema.ts";

function validCollection(): Record<string, unknown> {
  return {
    key: "posts",
    label: "Posts",
    slugField: "slug",
    fields: [
      { name: "title", type: { type: "text" }, required: true, confidence: 0.9 },
      { name: "body", label: "Body", type: { type: "richText" }, required: true },
      { name: "cover", type: { type: "image" }, required: false },
      { name: "author", type: { type: "reference", collectionKey: "authors" }, required: false },
      { name: "tags", type: { type: "multiReference", collectionKey: "tags" }, required: false },
      { name: "status", type: { type: "option", values: ["draft", "published"] }, required: true },
    ],
  };
}

describe("collectionSchema", () => {
  it("parses a valid collection", () => {
    expect(() => collectionSchema.parse(validCollection())).not.toThrow();
  });

  it("rejects unknown keys in a field (strict)", () => {
    const tampered = validCollection();
    (tampered["fields"] as Record<string, unknown>[])[0]!["extra"] = true;
    expect(collectionSchema.safeParse(tampered).success).toBe(false);
  });

  it("rejects a reserved field slug", () => {
    const tampered = validCollection();
    (tampered["fields"] as { slug: string }[])[0]!.slug = "_provenance";
    expect(collectionSchema.safeParse(tampered).success).toBe(false);
  });

  it("rejects a confidence outside 0..1", () => {
    const tampered = validCollection();
    (tampered["fields"] as { confidence?: number }[])[0]!.confidence = 1.5;
    expect(collectionSchema.safeParse(tampered).success).toBe(false);
  });
});
