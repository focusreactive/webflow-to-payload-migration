import { blocksResponseSchema } from "#discovery/schemas/blocks-response.ts";
import { ingestBlocksResponse } from "#discovery/steps/blocks-accept/ingest-blocks-response.ts";

import { STITCH } from "../../fixtures/discovery.ts";

describe("ingestBlocksResponse", () => {
  it("assembles an instance with computed boundaries", () => {
    const shard = ingestBlocksResponse({
      response: blocksResponseSchema.parse({
        route: "/",
        instances: [{ nodeIds: ["mig-5"], role: "hero", summary: "s" }],
      }),
      route: "/",
      stitchIndex: STITCH,
    });
    expect(shard.instances[0]).toEqual({
      route: "/",
      nodeIds: ["mig-5"],
      role: "hero",
      summary: "s",
      boundaries: { desktop: { rect: { x: 0, y: 100, width: 1440, height: 500 } } },
    });
  });
});
