import { z } from "zod";

// JSON-schema keywords Anthropic structured output rejects with a 400 and
// OpenAI-strict silently ignores (P1). Validation still happens at ingest
// with the full Zod schema; the LLM contract is a lossy projection.
const STRIPPED_CONSTRAINT_KEYWORDS = [
  "pattern",
  "format",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
] as const;

export function toLlmJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const emitted = z.toJSONSchema(schema, { io: "output", reused: "inline" }) as Record<string, unknown>;
  delete emitted["$schema"];
  projectNode(emitted, "#");
  return emitted;
}

function projectNode(node: unknown, path: string): void {
  if (Array.isArray(node)) {
    node.forEach((child, index) => projectNode(child, `${path}/${index}`));
    return;
  }
  if (node === null || typeof node !== "object") return;
  const record = node as Record<string, unknown>;

  if ("$ref" in record) {
    throw new Error(`llm-contract: $ref at ${path} — recursive/reused schemas are not supported by structured output`);
  }

  for (const keyword of STRIPPED_CONSTRAINT_KEYWORDS) delete record[keyword];

  if ("oneOf" in record) {
    record["anyOf"] = record["oneOf"];
    delete record["oneOf"];
  }

  if (record["type"] === "object") {
    if (record["additionalProperties"] !== false) {
      throw new Error(
        `llm-contract: object at ${path} does not emit additionalProperties:false — `
          + `records/loose objects are not allowed in LLM-facing schemas`,
      );
    }
    const properties = (record["properties"] ?? {}) as Record<string, unknown>;
    const required = (record["required"] ?? []) as string[];
    const optional = Object.keys(properties).filter((key) => !required.includes(key));
    if (optional.length > 0) {
      throw new Error(
        `llm-contract: optional keys [${optional.join(", ")}] at ${path} — LLM-facing schemas must `
          + `declare every key required (model absence explicitly, e.g. an empty array)`,
      );
    }
  }

  for (const [key, value] of Object.entries(record)) projectNode(value, `${path}/${key}`);
}
