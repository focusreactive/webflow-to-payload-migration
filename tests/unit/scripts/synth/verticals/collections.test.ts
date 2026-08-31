import type { CollectionField } from "#ir/schema.ts";
import { collectionContentResponseSchema } from "#synth/schemas/content-response.ts";
import { collectionFieldsResponseSchema, sectionFieldsResponseSchema } from "#synth/schemas/fields-response.ts";
import { collectionsVertical } from "#synth/verticals/collections.ts";

import { synthProject, writeShard } from "../fixtures/synth.ts";

const fields: CollectionField[] = [
  { name: "title", type: { type: "text" }, required: true },
  { name: "views", type: { type: "number" }, required: false },
];

const SCHEMA_SHARD = { label: "Blog", fields, pageBinding: { slugField: "title", meta: { title: "title" } } };

describe("collectionContentResponseSchema", () => {
  it("validates items against the collection's fields", () => {
    expect(
      collectionContentResponseSchema(fields).safeParse({ items: [{ title: "Hello World", views: 12 }] }).success,
    ).toBe(true);
  });

  it("rejects an item that violates the field schema", () => {
    expect(collectionContentResponseSchema(fields).safeParse({ items: [{ views: 12 }] }).success).toBe(false);
  });
});

describe("collectionsVertical.acceptContent", () => {
  it("mints id = slugifyId(item[slugField]) and stamps the ai provenance", async () => {
    const root = await synthProject("collections-accept");
    await writeShard(root, "collections", "blog", "schema.json", SCHEMA_SHARD);

    const outcome = await collectionsVertical.acceptContent(root, "blog", {
      items: [{ title: "Hello World", views: 12 }],
    });

    expect(outcome.ok).toBe(true);
    const items = outcome.ok ? (outcome.shard as { items: Record<string, unknown>[] }).items : [];
    expect(items).toHaveLength(1);
    expect(items[0]?.["id"]).toBe("hello-world");
    expect(items[0]?.["_provenance"]).toBe("ai");
    expect(items[0]?.["title"]).toBe("Hello World");
  });
});

describe("collectionsVertical.acceptFields", () => {
  it("accepts a response whose pageBinding.slugField is a declared text field", async () => {
    const response = collectionFieldsResponseSchema.parse(SCHEMA_SHARD);

    const outcome = await collectionsVertical.acceptFields("/tmp/p", { key: "blog" }, response);

    expect(outcome.ok).toBe(true);
    const shard = outcome.ok ? (outcome.shard as typeof SCHEMA_SHARD) : undefined;
    expect(shard?.pageBinding.slugField).toBe("title");
    expect(shard?.fields).toHaveLength(2);
  });

  it("rejects a response whose pageBinding.slugField is not a declared text field", async () => {
    const response = collectionFieldsResponseSchema.parse({
      ...SCHEMA_SHARD,
      pageBinding: { slugField: "views", meta: {} },
    });

    const outcome = await collectionsVertical.acceptFields("/tmp/p", { key: "blog" }, response);

    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome.ok === false ? outcome.errors : [])).toMatch(/slugField/);
  });

  it("rejects a section response naming a field the collection does not declare", async () => {
    const root = await synthProject("collections-section");
    await writeShard(root, "collections", "blog", "schema.json", SCHEMA_SHARD);
    const response = sectionFieldsResponseSchema.parse({ itemFields: ["title", "ghost"] });

    const outcome = await collectionsVertical.acceptFields(root, { key: "blog", section: "hero" }, response);

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.errors[0]).toMatchObject({ code: "UNKNOWN_ITEM_FIELD", got: "ghost" });
  });
});
