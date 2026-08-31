import { buildLayoutPayloadSchema } from "#layout/schemas/layout-payload.ts";
import { toLlmJsonSchema } from "#ir/llm-contract.ts";

import { HERO } from "../fixtures/layout.ts";

describe("buildLayoutPayloadSchema", () => {
  it("static unit: accepts literals, rejects bindings by contract", () => {
    const payloadSchema = buildLayoutPayloadSchema({ route: "/about", blocks: [HERO] });
    const literal = {
      unit: { kind: "static", route: "/about" },
      missedFields: [],
      blocks: [
        {
          blockType: "hero",
          anchorMigId: "mig-h",
          confidence: 0.9,
          fields: { title: { kind: "literal", value: "Hi" }, subtitle: null, cover: null },
        },
      ],
    };
    expect(payloadSchema.safeParse(literal).success).toBe(true);
    const bound = structuredClone(literal);
    (bound.blocks[0]!.fields as Record<string, unknown>)["title"] = {
      kind: "binding",
      collectionKey: "works",
      fieldKey: "title",
    };
    expect(payloadSchema.safeParse(bound).success).toBe(false);
  });

  it("static unit: the emitted contract structurally has no binding arm", () => {
    const payloadSchema = buildLayoutPayloadSchema({ route: "/about", blocks: [HERO] });
    const emitted = JSON.stringify(toLlmJsonSchema(payloadSchema));
    expect(emitted).not.toContain("$ref");
    expect(emitted).not.toContain('"binding"');
  });

  it("pins the unit route of the payload to the unit being authored", () => {
    const payloadSchema = buildLayoutPayloadSchema({ route: "/about", blocks: [HERO] });
    const otherRoute = {
      unit: { kind: "static", route: "/contact" },
      missedFields: [],
      blocks: [],
    };
    expect(payloadSchema.safeParse(otherRoute).success).toBe(false);
  });

  it("throws on an empty vocabulary", () => {
    expect(() => buildLayoutPayloadSchema({ route: "/", blocks: [] })).toThrow();
  });
});
