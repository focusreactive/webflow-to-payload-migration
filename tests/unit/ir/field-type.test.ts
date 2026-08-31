import { z } from "zod";

import { fieldTypeSchema, MAX_FIELD_TYPE_DEPTH, scalarTypeSchema } from "#ir/field-type.ts";
import { toLlmJsonSchema } from "#ir/llm-contract.ts";

function walk(node: unknown, visit: (record: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  if (node === null || typeof node !== "object") return;
  visit(node as Record<string, unknown>);
  Object.values(node).forEach((child) => walk(child, visit));
}

describe("fieldTypeSchema", () => {
  it("parses every scalar type", () => {
    for (const type of scalarTypeSchema.options) {
      expect(fieldTypeSchema.safeParse({ type }).success).toBe(true);
    }
  });

  it("parses composite types: array<image>, array<array>, group, reference, multiReference, option", () => {
    expect(fieldTypeSchema.safeParse({ type: "array", element: { type: "image" } }).success).toBe(true);
    expect(
      fieldTypeSchema.safeParse({ type: "array", element: { type: "array", element: { type: "text" } } }).success,
    ).toBe(true);
    expect(
      fieldTypeSchema.safeParse({
        type: "group",
        fields: [{ name: "title", type: { type: "text" }, required: true }],
      }).success,
    ).toBe(true);
    expect(fieldTypeSchema.safeParse({ type: "reference", collectionKey: "authors" }).success).toBe(true);
    expect(fieldTypeSchema.safeParse({ type: "multiReference", collectionKey: "tags" }).success).toBe(true);
    expect(fieldTypeSchema.safeParse({ type: "option", values: ["a", "b"] }).success).toBe(true);
    expect(fieldTypeSchema.safeParse({ type: "unsupported" }).success).toBe(true);
  });

  it("rejects nesting deeper than MAX_FIELD_TYPE_DEPTH", () => {
    // Build array nested one level past the bound; the leaf at the bottom is no
    // longer allowed to be composite, so an array-of-array chain overflows.
    let node: unknown = { type: "text" };
    for (let depth = 0; depth <= MAX_FIELD_TYPE_DEPTH + 1; depth += 1) {
      node = { type: "array", element: node };
    }
    expect(fieldTypeSchema.safeParse(node).success).toBe(false);
  });
});

describe("LLM projection of the dictionary (load-bearing spike)", () => {
  const wrapper = z.object({ collectionKey: z.string(), field: fieldTypeSchema });

  it("projects the full recursive dictionary with no $ref and additionalProperties:false everywhere", () => {
    const projected = toLlmJsonSchema(wrapper);
    let objectCount = 0;
    walk(projected, (record) => {
      expect("$ref" in record).toBe(false);
      if (record["type"] === "object") {
        objectCount += 1;
        expect(record["additionalProperties"]).toBe(false);
        expect(record["required"]).toEqual(Object.keys(record["properties"] as Record<string, unknown>));
      }
    });
    expect(objectCount).toBeGreaterThan(0);
  });

  it("projects a bare field schema without an enclosing collectionKey (compact, no throw)", () => {
    expect(() => toLlmJsonSchema(z.object({ field: fieldTypeSchema }))).not.toThrow();
  });
});
