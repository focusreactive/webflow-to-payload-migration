import type { FieldType } from "#ir/field-type.ts";
import { buildIngestRecordSchema, valueSchemaForFieldType } from "#ir/field-value.ts";
import type { CollectionField } from "#ir/schema.ts";

describe("valueSchemaForFieldType over collection field types", () => {
  it("maps scalars, media, references, arrays and options per the record form", () => {
    expect(valueSchemaForFieldType({ type: "text" }).safeParse("hi").success).toBe(true);
    expect(valueSchemaForFieldType({ type: "number" }).safeParse(3).success).toBe(true);
    expect(valueSchemaForFieldType({ type: "boolean" }).safeParse(true).success).toBe(true);
    expect(valueSchemaForFieldType({ type: "richText" }).safeParse("<h2>x</h2>").success).toBe(true);
    expect(valueSchemaForFieldType({ type: "image" }).safeParse({ assetId: "asset-1", alt: "a" }).success).toBe(true);
    expect(valueSchemaForFieldType({ type: "image" }).safeParse("not-a-ref").success).toBe(false);
    expect(
      valueSchemaForFieldType({ type: "reference", collectionKey: "authors" } as FieldType).safeParse("jane").success,
    ).toBe(true);
    expect(
      valueSchemaForFieldType({ type: "multiReference", collectionKey: "tags" } as FieldType).safeParse(["a", "b"])
        .success,
    ).toBe(true);
    expect(
      valueSchemaForFieldType({ type: "array", element: { type: "image" } }).safeParse([{ assetId: "a" }]).success,
    ).toBe(true);
    expect(valueSchemaForFieldType({ type: "option", values: ["draft", "published"] }).safeParse("draft").success).toBe(
      true,
    );
    expect(
      valueSchemaForFieldType({ type: "option", values: ["draft", "published"] }).safeParse("archived").success,
    ).toBe(false);
  });
});

describe("buildIngestRecordSchema over collection item records", () => {
  const fields: CollectionField[] = [
    { name: "title", type: { type: "text" }, required: true },
    { name: "cover", type: { type: "image" }, required: false },
  ];

  it("requires required fields and allows optional ones to be absent", () => {
    const validator = buildIngestRecordSchema(fields);
    expect(validator.safeParse({ title: "A" }).success).toBe(true);
    expect(validator.safeParse({ cover: { assetId: "a" } }).success).toBe(false); // title missing
  });

  it("accepts the AI's null-for-absent dialect and yields the canonical record", () => {
    const validator = buildIngestRecordSchema(fields);
    const parsed = validator.safeParse({ title: "A", cover: null });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ title: "A" });
    expect(validator.safeParse({ title: "A", cover: { assetId: "a", alt: null } }).data).toEqual({
      title: "A",
      cover: { assetId: "a" },
    });
  });

  it("rejects a null in a required position", () => {
    expect(buildIngestRecordSchema(fields).safeParse({ title: null }).success).toBe(false);
  });

  it("rejects unknown field slugs (strict)", () => {
    const validator = buildIngestRecordSchema(fields);
    expect(validator.safeParse({ title: "A", ghost: 1 }).success).toBe(false);
  });

  it("validates array<group> values", () => {
    const validator = buildIngestRecordSchema([
      {
        name: "services",
        type: {
          type: "array",
          element: { type: "group", fields: [{ name: "label", type: { type: "text" }, required: true }] },
        },
        required: true,
      },
    ]);
    expect(validator.safeParse({ services: [{ label: "one" }, { label: "two" }] }).success).toBe(true);
    expect(validator.safeParse({ services: [{ label: 5 }] }).success).toBe(false);
  });
});
