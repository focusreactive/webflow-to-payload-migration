import {
  LAYOUT_SCHEMA_VERSION,
  layoutRecordSchema,
  layoutRouteArtifactFor,
  layoutUnitMetaSchema,
} from "#ir/layout.ts";

const record = {
  order: 0,
  blockType: "hero",
  anchorMigId: "mig-1",
  fields: {
    title: { kind: "literal", value: "Hello" },
    cover: { kind: "literal", value: { assetId: "a1", alt: "cover" } },
  },
  _provenance: "ai",
  _confidence: 0.9,
};

describe("layoutRecordSchema", () => {
  it("accepts a record of literal sources", () => {
    expect(layoutRecordSchema.safeParse(record).success).toBe(true);
  });

  it("rejects a binding source (arm removed)", () => {
    expect(
      layoutRecordSchema.safeParse({
        ...record,
        fields: { title: { kind: "binding", collectionKey: "works", fieldKey: "title" } },
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys and malformed sources", () => {
    expect(layoutRecordSchema.safeParse({ ...record, extra: 1 }).success).toBe(false);
    expect(
      layoutRecordSchema.safeParse({ ...record, fields: { title: { kind: "literal" } } }).success,
    ).toBe(false);
  });

  it("requires a non-negative order and a provenance", () => {
    expect(layoutRecordSchema.safeParse({ ...record, order: -1 }).success).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _provenance, ...withoutProvenance } = record;
    expect(layoutRecordSchema.safeParse(withoutProvenance).success).toBe(false);
  });
});

describe("layout artifact factories", () => {
  it("keys static units by routeKey under layout/routes/", () => {
    const def = layoutRouteArtifactFor("company/about");
    expect(def.kind).toBe("layout");
    expect(def.relativePath).toBe("layout/routes/company/about.ndjson");
    expect(def.schemaVersion).toBe(LAYOUT_SCHEMA_VERSION);
  });
});

describe("layoutUnitMetaSchema", () => {
  it("parses static and template metas", () => {
    expect(layoutUnitMetaSchema.safeParse({ unitKind: "static", route: "/about" }).success).toBe(true);
    expect(
      layoutUnitMetaSchema.safeParse({
        unitKind: "template",
        collectionKey: "works",
        routePattern: "/works/:slug",
        representativeRoute: "/works/alpha",
      }).success,
    ).toBe(true);
    expect(layoutUnitMetaSchema.safeParse({ unitKind: "page" }).success).toBe(false);
  });
});
