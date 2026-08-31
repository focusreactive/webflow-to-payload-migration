import { TOKEN_CANDIDATES_SCHEMA_VERSION, tokenCandidatesArtifact } from "#tokens/schemas/token-candidates.ts";
import { artifactEnvelope } from "#ir/artifact.ts";

const envelope = artifactEnvelope(tokenCandidatesArtifact.dataSchema, TOKEN_CANDIDATES_SCHEMA_VERSION);

function validCandidates(): Record<string, unknown> {
  return {
    schemaVersion: TOKEN_CANDIDATES_SCHEMA_VERSION,
    provenance: "published",
    data: {
      colors: [
        {
          id: "color-1",
          value: "rgb(37, 99, 235)",
          oklch: { l: 0.5461, c: 0.2152, h: 262.8809, alpha: 1 },
          usageCount: 12,
        },
      ],
      fontFamilies: [{ id: "font-family-1", stack: ["Inter", "sans-serif"], usageCount: 10 }],
      fontSizes: [{ id: "font-size-1", value: 16, usageCount: 8 }],
      fontWeights: [],
      lineHeights: [],
      letterSpacings: [],
      spacings: [],
      radii: [],
      shadows: [
        {
          id: "shadow-1",
          value: "rgba(0, 0, 0, 0.1) 0px 4px 12px 0px",
          layers: [{ color: "rgba(0, 0, 0, 0.1)", offsetX: 0, offsetY: 4, blur: 12, spread: 0, inset: false }],
          usageCount: 3,
        },
      ],
      breakpoints: [{ id: "breakpoint-1", valuePx: 768, usageCount: 4 }],
      gradients: [{ value: "linear-gradient(rgb(0, 0, 0), rgb(255, 255, 255))", usageCount: 1 }],
    },
  };
}

describe("tokenCandidatesArtifact", () => {
  it("registers under the expected kind and path", () => {
    expect(tokenCandidatesArtifact.kind).toBe("token-candidates");
    expect(tokenCandidatesArtifact.relativePath).toBe("token-candidates.json");
  });

  it("parses a valid envelope", () => {
    expect(() => envelope.parse(validCandidates())).not.toThrow();
  });

  it("rejects a colour candidate that still carries cluster members", () => {
    const tampered = validCandidates();
    const colors = (tampered["data"] as { colors: Record<string, unknown>[] }).colors;
    const color = colors[0];
    if (color !== undefined) color["members"] = [];
    expect(envelope.safeParse(tampered).success).toBe(false);
  });

  it("rejects unknown keys anywhere in the tree (strict artifact)", () => {
    const tampered = validCandidates();
    (tampered["data"] as Record<string, unknown>)["extra"] = true;
    expect(envelope.safeParse(tampered).success).toBe(false);
  });

  it("rejects a foreign schemaVersion", () => {
    expect(envelope.safeParse({ ...validCandidates(), schemaVersion: 99 }).success).toBe(false);
  });
});
