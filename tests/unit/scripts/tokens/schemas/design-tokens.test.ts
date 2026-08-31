import { DESIGN_TOKENS_SCHEMA_VERSION, designTokensArtifact, tokenNameSchema } from "#tokens/schemas/design-tokens.ts";
import { artifactEnvelope } from "#ir/artifact.ts";

const envelope = artifactEnvelope(designTokensArtifact.dataSchema, DESIGN_TOKENS_SCHEMA_VERSION);

function validTokens(): Record<string, unknown> {
  return {
    schemaVersion: DESIGN_TOKENS_SCHEMA_VERSION,
    provenance: "ai",
    data: {
      primitive: {
        color: {
          "brand-blue": {
            $type: "color",
            $value: { colorSpace: "oklch", components: [0.5461, 0.2152, 262.8809], alpha: 1, hex: "#2563eb" },
          },
        },
        fontFamily: { sans: { $type: "fontFamily", $value: ["Inter", "sans-serif"] } },
        fontSize: { base: { $type: "dimension", $value: { value: 16, unit: "px" } } },
        fontWeight: {},
        lineHeight: {},
        letterSpacing: {},
        spacing: {},
        radius: {},
        shadow: {
          md: {
            $type: "shadow",
            $value: [
              {
                color: { colorSpace: "oklch", components: [0, 0, 0], alpha: 0.1, hex: "#000000" },
                offsetX: { value: 0, unit: "px" },
                offsetY: { value: 4, unit: "px" },
                blur: { value: 12, unit: "px" },
                spread: { value: 0, unit: "px" },
                inset: false,
              },
            ],
          },
        },
        breakpoint: { md: { $type: "dimension", $value: { value: 768, unit: "px" } } },
      },
      semantic: {
        color: {
          primary: { $type: "color", $value: "{primitive.color.brand-blue}" },
          "primary-soft": {
            $type: "color",
            $value: "color-mix(in oklab, {primitive.color.brand-blue} 20%, transparent)",
          },
          "primary-hover": { $type: "color", $value: "{semantic.color.primary}" },
        },
      },
    },
  };
}

function tamperSemantic(value: string): unknown {
  const tampered = validTokens();
  const data = tampered["data"] as { semantic: { color: Record<string, unknown> } };
  data.semantic.color["primary"] = { $type: "color", $value: value };
  return tampered;
}

describe("designTokensArtifact", () => {
  it("parses a valid envelope with ai provenance", () => {
    expect(() => envelope.parse(validTokens())).not.toThrow();
  });

  it("rejects a non-kebab token name", () => {
    expect(tokenNameSchema.safeParse("Brand Blue").success).toBe(false);
    expect(tokenNameSchema.safeParse("brand-blue").success).toBe(true);
  });

  it("accepts a role that references another role", () => {
    expect(envelope.safeParse(tamperSemantic("{semantic.color.primary-soft}")).success).toBe(true);
  });

  it("rejects a role value outside the two accepted forms", () => {
    expect(envelope.safeParse(tamperSemantic("rgb(37, 99, 235)")).success).toBe(false);
    expect(envelope.safeParse(tamperSemantic("color-mix(in srgb, {primitive.color.x} 20%, transparent)")).success).toBe(
      false,
    );
  });

  it("rejects a per-token $extensions block — the artifact is plain DTCG", () => {
    const tampered = validTokens();
    const primitive = (tampered["data"] as { primitive: { color: Record<string, Record<string, unknown>> } }).primitive;
    const token = primitive.color["brand-blue"];
    if (token !== undefined) token["$extensions"] = { any: true };
    expect(envelope.safeParse(tampered).success).toBe(false);
  });

  it("rejects a foreign schemaVersion", () => {
    expect(envelope.safeParse({ ...validTokens(), schemaVersion: 99 }).success).toBe(false);
  });
});
