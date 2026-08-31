import { contentRecordSchema } from "#ir/content.ts";

describe("contentRecordSchema", () => {
  it("preserves arbitrary field values keyed by slug (looseObject)", () => {
    const parsed = contentRecordSchema.parse({
      id: "annual-report",
      _provenance: "ai",
      _confidence: 0.8,
      title: "Annual report",
      cover: { assetId: "asset-1", alt: "cover" },
      tags: ["news", "finance"],
    });
    expect(parsed).toMatchObject({ id: "annual-report", title: "Annual report" });
    expect((parsed as Record<string, unknown>)["tags"]).toEqual(["news", "finance"]);
  });

  it("rejects a missing id and a bad provenance", () => {
    expect(contentRecordSchema.safeParse({ _provenance: "ai", title: "x" }).success).toBe(false);
    expect(contentRecordSchema.safeParse({ id: "a", _provenance: "nope" }).success).toBe(false);
  });
});
