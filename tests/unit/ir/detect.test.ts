import { detectArtifact, detectDataSchema, type DetectData } from "#ir/detect.ts";

const validData: DetectData = {
  verdict: "webflow",
  scores: {
    webflow: {
      score: 12,
      hasTier1Strong: true,
      signals: [
        {
          id: "wf-data-attr",
          tier: "strong",
          evidence: 'data-wf-site="abc123"',
        },
      ],
    },
  },
  thresholds: { confidence: 8 },
  platformHints: {
    webflowSiteId: "5f9b3c1e2a1b2c3d4e5f6789",
  },
};

describe("detectDataSchema", () => {
  it("parses a valid DetectData object", () => {
    expect(detectDataSchema.parse(validData)).toEqual(validData);
  });

  it("round-trips through JSON", () => {
    const roundTripped = detectDataSchema.parse(JSON.parse(JSON.stringify(validData)));

    expect(roundTripped).toEqual(validData);
  });

  it("rejects an unknown key at the top level", () => {
    expect(() => detectDataSchema.parse({ ...validData, extra: "nope" })).toThrow();
  });

  it("rejects an unknown key on a nested strictObject (platformHints)", () => {
    expect(() =>
      detectDataSchema.parse({
        ...validData,
        platformHints: { ...validData.platformHints, bogus: "nope" },
      }),
    ).toThrow();
  });

  it("allows platformHints with no optional fields set", () => {
    expect(() => detectDataSchema.parse({ ...validData, platformHints: {} })).not.toThrow();
  });
});

describe("detectArtifact", () => {
  it("matches the ArtifactDef contract for the detect kind", () => {
    expect(detectArtifact.kind).toBe("detect");
    expect(detectArtifact.relativePath).toBe("detect.json");
    expect(detectArtifact.schemaVersion).toBe(1);
    expect(detectArtifact.dataSchema).toBe(detectDataSchema);
  });
});
