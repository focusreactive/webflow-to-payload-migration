import { ingestLayoutPayload } from "#layout/steps/accept/ingest-layout-payload.ts";
import type { AcceptError } from "#layout/types.ts";
import type { BlockType } from "#ir/blocks.ts";

const hero = {
  id: "hero",
  name: "Hero",
  source: { route: "/", anchorMigId: "mig-h" },
  fields: [
    { name: "title", type: { type: "text" }, required: true },
    { name: "cover", type: { type: "image" }, required: false },
  ],
} as unknown as BlockType;

const knownMigIds = new Set(["mig-h", "mig-h2"]);

function staticPayload(fields: Record<string, unknown>): unknown {
  return {
    unit: { kind: "static", route: "/about" },
    missedFields: [],
    blocks: [{ blockType: "hero", anchorMigId: "mig-h", confidence: 0.8, fields }],
  };
}

function errorsOf(outcome: ReturnType<typeof ingestLayoutPayload>): AcceptError[] {
  if (outcome.ok) throw new Error("expected the ingest to reject the payload");
  return outcome.errors;
}

describe("ingestLayoutPayload (static unit)", () => {
  const opts = { route: "/about", blocks: [hero], knownMigIds };

  it("accepts literal fields and mints order from array position", () => {
    const outcome = ingestLayoutPayload({
      ...opts,
      response: {
        unit: { kind: "static", route: "/about" },
        missedFields: [],
        blocks: [
          {
            blockType: "hero",
            anchorMigId: "mig-h",
            confidence: 0.8,
            fields: { title: { kind: "literal", value: "About our team" }, cover: null },
          },
          {
            blockType: "hero",
            anchorMigId: "mig-h2",
            confidence: 0.7,
            fields: { title: { kind: "literal", value: "More about the studio" }, cover: null },
          },
        ],
      },
    });
    if (!outcome.ok) throw new Error(`expected the ingest to pass: ${JSON.stringify(outcome.errors)}`);
    expect(outcome.records.map((record) => record.order)).toEqual([0, 1]);
    expect(outcome.records[0]!._provenance).toBe("ai");
    expect(outcome.records[0]!.fields["title"]).toEqual({ kind: "literal", value: "About our team" });
    expect(outcome.records[1]!.fields["cover"]).toBeUndefined();
  });

  it("fails loud on missedFields with the re-inference instruction", () => {
    const response = {
      unit: { kind: "static", route: "/about" },
      missedFields: [{ collectionKey: "works", fieldName: "client", evidence: "varies across items, no schema field" }],
      blocks: [],
    };
    const errors = errorsOf(ingestLayoutPayload({ ...opts, response }));
    expect(errors.map((error) => error.code)).toEqual(["MISSED_FIELD"]);
    expect(errors[0]!.fix).toMatch(/schema --force/);
  });

  it("fails loud on an unknown assetId when assets.json is present", () => {
    const errors = errorsOf(
      ingestLayoutPayload({
        ...opts,
        knownAssetIds: new Set(["other"]),
        response: staticPayload({
          title: { kind: "literal", value: "About our team" },
          cover: { kind: "literal", value: { assetId: "a9", alt: null } },
        }),
      }),
    );
    expect(errors.map((error) => error.code)).toEqual(["UNKNOWN_ASSET_ID"]);
  });

  it("rejects a binding on a static route at the schema layer", () => {
    const errors = errorsOf(
      ingestLayoutPayload({
        ...opts,
        response: {
          unit: { kind: "static", route: "/about" },
          missedFields: [],
          blocks: [
            {
              blockType: "hero",
              anchorMigId: "mig-h",
              confidence: 0.9,
              fields: { title: { kind: "binding", collectionKey: "works", fieldKey: "title" }, cover: null },
            },
          ],
        },
      }),
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((error) => error.code === "SCHEMA")).toBe(true);
  });

  it("accepts an all-literal page and re-validates literals strictly", () => {
    const outcome = ingestLayoutPayload({
      ...opts,
      response: {
        unit: { kind: "static", route: "/about" },
        missedFields: [],
        blocks: [
          {
            blockType: "hero",
            anchorMigId: "mig-h",
            confidence: 0.9,
            fields: {
              title: { kind: "literal", value: "About our team" },
              cover: { kind: "literal", value: { assetId: "a1", alt: null } },
            },
          },
        ],
      },
    });
    if (!outcome.ok) throw new Error(`expected the ingest to pass: ${JSON.stringify(outcome.errors)}`);
    expect(outcome.records).toHaveLength(1);
    expect(outcome.records[0]!.fields["cover"]).toEqual({ kind: "literal", value: { assetId: "a1" } });
  });

  it("supports an empty page (chrome only)", () => {
    const outcome = ingestLayoutPayload({
      ...opts,
      response: { unit: { kind: "static", route: "/about" }, missedFields: [], blocks: [] },
    });
    if (!outcome.ok) throw new Error(`expected the ingest to pass: ${JSON.stringify(outcome.errors)}`);
    expect(outcome.records).toEqual([]);
  });
});
