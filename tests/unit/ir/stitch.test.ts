import { STITCH_INDEX_SCHEMA_VERSION, stitchIndexSchema } from "#ir/stitch.ts";

const VALID = {
  schemaVersion: STITCH_INDEX_SCHEMA_VERSION,
  provenance: "published",
  data: {
    route: "/",
    url: "https://example.com/",
    capturedAt: "2026-07-21T00:00:00.000Z",
    stitches: {
      desktop: {
        file: "desktop.png",
        doc: { width: 1440, height: 3200 },
        dpr: 1,
        pixels: { width: 1440, height: 3200 },
        stickyRegions: [{ migId: "mig-1", rect: { x: 0, y: 0, width: 1440, height: 64 } }],
      },
    },
    elements: {
      "mig-7": { desktop: { rect: { x: 0, y: 800, width: 1440, height: 400 } } },
    },
  },
};

describe("stitchIndexSchema", () => {
  it("round-trips a valid stitch index", () => {
    expect(stitchIndexSchema.parse(VALID)).toEqual(VALID);
  });

  it("rejects unknown keys in the data envelope", () => {
    expect(() => stitchIndexSchema.parse({ ...VALID, data: { ...VALID.data, extra: 1 } })).toThrow();
  });

  it("rejects a mismatched schemaVersion", () => {
    expect(() => stitchIndexSchema.parse({ ...VALID, schemaVersion: 99 })).toThrow();
  });
});
