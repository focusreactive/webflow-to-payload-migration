import { validateLayoutPayload } from "#layout/steps/accept/validate-layout-payload.ts";
import type { LayoutPayload } from "#layout/types.ts";

import { HERO } from "../../fixtures/layout.ts";

describe("validateLayoutPayload", () => {
  const blocksById = new Map([["hero", HERO]]);
  const knownMigIds = new Set(["mig-h"]);
  const base: LayoutPayload = {
    unit: { kind: "static", route: "/about" },
    missedFields: [],
    blocks: [
      {
        blockType: "hero",
        anchorMigId: "mig-h",
        confidence: 0.8,
        fields: { title: { kind: "literal", value: "Hi" } },
      },
    ],
  };
  const opts = { knownMigIds, blocksById };

  it("passes a valid payload", () => {
    expect(validateLayoutPayload({ ...opts, payload: base })).toEqual([]);
  });

  it("rejects unknown anchors and duplicate anchors", () => {
    const unknownAnchor = structuredClone(base);
    unknownAnchor.blocks[0]!.anchorMigId = "mig-x";
    expect(validateLayoutPayload({ ...opts, payload: unknownAnchor }).map((error) => error.code)).toEqual([
      "UNKNOWN_ANCHOR",
    ]);

    const duplicated = structuredClone(base);
    duplicated.blocks.push(structuredClone(duplicated.blocks[0]!));
    expect(validateLayoutPayload({ ...opts, payload: duplicated }).map((error) => error.code)).toEqual([
      "DUPLICATE_ANCHOR",
    ]);
  });

  it("rejects an unknown blockType", () => {
    const unknownBlock = structuredClone(base);
    unknownBlock.blocks[0]!.blockType = "nope";
    expect(validateLayoutPayload({ ...opts, payload: unknownBlock }).map((error) => error.code)).toEqual([
      "UNKNOWN_BLOCK_TYPE",
    ]);
  });
});
