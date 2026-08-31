import { collectionEntrySchema, collectionsDataSchema, validatePageBinding } from "#ir/collections.ts";

const ENTRY = {
  key: "blog",
  label: "Blog",
  fields: [
    { name: "title", type: { type: "text" } as const, required: true },
    { name: "body", type: { type: "richText" } as const, required: false },
  ],
  pageBinding: { slugField: "title", meta: { title: "title", description: "body" } },
  items: [{ id: "hello", _provenance: "ai", title: "Hello", body: "<p>x</p>" }],
};

describe("collections fold", () => {
  it("round-trips a collection entry", () => {
    expect(collectionsDataSchema.parse({ collections: [ENTRY] })).toEqual({
      collections: [{ ...ENTRY, template: [] }],
    });
  });
  it("accepts a valid pageBinding and rejects unknown fields / non-text slug", () => {
    expect(validatePageBinding(ENTRY)).toEqual([]);
    expect(validatePageBinding({ ...ENTRY, pageBinding: { slugField: "nope", meta: {} } })[0]).toMatch(/slugField/);
    expect(
      validatePageBinding({ ...ENTRY, pageBinding: { slugField: "title", meta: { title: "ghost" } } })[0],
    ).toMatch(/meta/);
  });
  it("round-trips a collection entry carrying a section template", () => {
    const entry = collectionEntrySchema.parse({
      key: "blog",
      label: "Blog",
      fields: [{ name: "title", type: { type: "text" }, required: true }],
      pageBinding: { slugField: "title", meta: {} },
      items: [{ id: "a", _provenance: "ai", title: "A" }],
      template: [{ sectionId: "hero", itemFields: ["title"] }],
    });
    expect(entry.template[0]?.itemFields).toEqual(["title"]);
  });
});
