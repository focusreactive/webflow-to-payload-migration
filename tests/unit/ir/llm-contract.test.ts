import { z } from "zod";

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

describe("toLlmJsonSchema", () => {
  const payload = z.object({
    names: z.array(z.object({ clusterId: z.string().min(1).brand<"ClusterId">(), name: z.string().regex(/^[a-z]+$/) })),
    count: z.number().int().min(0).max(10),
    scale: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("modular"), ratio: z.number() }),
      z.object({ kind: z.literal("bespoke") }),
    ]),
  });

  it("emits additionalProperties:false on every object and keeps every key required", () => {
    const schema = toLlmJsonSchema(payload);
    walk(schema, (record) => {
      if (record["type"] !== "object") return;
      expect(record["additionalProperties"]).toBe(false);
      expect(record["required"]).toEqual(Object.keys(record["properties"] as Record<string, unknown>));
    });
  });

  it("strips numeric/length/pattern constraints and the root $schema, erases brands", () => {
    const schema = toLlmJsonSchema(payload);
    expect(schema["$schema"]).toBeUndefined();
    const forbidden = new Set(["pattern", "format", "minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minItems", "maxItems"]);
    walk(schema, (record) => {
      for (const key of Object.keys(record)) expect(forbidden.has(key), `constraint '${key}' must be stripped`).toBe(false);
    });
  });

  it("keeps unions as non-root anyOf with const discriminators", () => {
    const schema = toLlmJsonSchema(payload) as { properties: { scale: { anyOf: unknown[] } } };
    expect(schema.properties.scale.anyOf).toHaveLength(2);
  });

  it("rejects records: additionalProperties must not be a schema", () => {
    expect(() => toLlmJsonSchema(z.object({ bad: z.record(z.string(), z.string()) }))).toThrow(/additionalProperties/);
  });

  it("rejects optional keys — absence must be modeled explicitly", () => {
    expect(() => toLlmJsonSchema(z.object({ maybe: z.string().optional() }))).toThrow(/optional/i);
  });

  it("rejects recursive schemas ($ref)", () => {
    interface Node {
      children: Node[];
    }
    const node: z.ZodType<Node> = z.object({ children: z.lazy(() => z.array(node)) });
    expect(() => toLlmJsonSchema(z.object({ tree: node }))).toThrow(/\$ref|recursi/i);
  });
});
