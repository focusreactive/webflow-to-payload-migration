import { payloadField, payloadFieldType } from "#generate/codegen/fields.ts";

describe("payloadFieldType (shared IR -> Payload map, P08)", () => {
  it("maps scalars per the P08 table", () => {
    expect(payloadFieldType({ type: "richText" })).toEqual({ type: "richText" });
    expect(payloadFieldType({ type: "boolean" })).toEqual({ type: "checkbox" });
    expect(payloadFieldType({ type: "color" })).toEqual({ type: "text" });
    expect(payloadFieldType({ type: "image" })).toEqual({ type: "upload", relationTo: "media" });
    expect(payloadFieldType({ type: "video" })).toEqual({ type: "upload", relationTo: "media" });
  });

  it("maps composites: option/select, relationships, array{item}, group", () => {
    expect(payloadFieldType({ type: "option", values: ["a", "b"] })).toEqual({
      type: "select",
      options: [
        { label: "a", value: "a" },
        { label: "b", value: "b" },
      ],
    });
    expect(payloadFieldType({ type: "multiReference", collectionKey: "works" } as never)).toEqual({
      type: "relationship",
      relationTo: "works",
      hasMany: true,
    });
    expect(payloadFieldType({ type: "array", element: { type: "image" } })).toEqual({
      type: "array",
      fields: [{ name: "item", type: "upload", relationTo: "media" }],
    });
  });

  it("emits required/label only when set", () => {
    expect(payloadField({ name: "title", type: { type: "text" }, required: true })).toEqual({
      name: "title",
      type: "text",
      required: true,
    });
    expect(payloadField({ name: "note", label: "Note", type: { type: "text" }, required: false })).toEqual({
      name: "note",
      type: "text",
      label: "Note",
    });
  });
});
