import { z } from "zod";

import { anyValueSourceSchema, valueSource } from "#ir/value-source.ts";

describe("valueSource factory (literal-only)", () => {
  const stringSource = valueSource(z.string().min(1));

  it("accepts a literal whose value matches the parameter schema", () => {
    expect(stringSource.parse({ kind: "literal", value: "Hello" })).toEqual({ kind: "literal", value: "Hello" });
  });

  it("rejects a literal whose value violates the parameter schema", () => {
    expect(stringSource.safeParse({ kind: "literal", value: 42 }).success).toBe(false);
  });

  it("rejects unknown keys on the literal arm (strict IR contract)", () => {
    expect(stringSource.safeParse({ kind: "literal", value: "x", extra: 1 }).success).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(stringSource.safeParse({ kind: "list", value: "x" }).success).toBe(false);
  });
});

describe("anyValueSourceSchema (literal-only)", () => {
  it("accepts a literal source", () => {
    expect(anyValueSourceSchema.parse({ kind: "literal", value: 42 })).toEqual({ kind: "literal", value: 42 });
  });

  it("rejects a binding source (arm removed)", () => {
    expect(() => anyValueSourceSchema.parse({ kind: "binding", collectionKey: "c", fieldKey: "f" })).toThrow();
  });

  it("keeps the literal value key required", () => {
    expect(anyValueSourceSchema.safeParse({ kind: "literal" }).success).toBe(false);
  });

  it("accepts any JSON-shaped literal value, to be re-validated by a second pass", () => {
    expect(anyValueSourceSchema.safeParse({ kind: "literal", value: { assetId: "a1", alt: "x" } }).success).toBe(true);
    expect(anyValueSourceSchema.safeParse({ kind: "literal", value: [1, "two", true] }).success).toBe(true);
  });

  it("rejects a non-JSON literal value", () => {
    expect(anyValueSourceSchema.safeParse({ kind: "literal", value: undefined }).success).toBe(false);
  });
});
