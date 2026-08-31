import {
  buildExcludedSet,
  validateBlocksResponse,
} from "#discovery/steps/blocks-accept/utils/ingest-blocks-response.ts";
import { blocksResponseSchema } from "#discovery/schemas/blocks-response.ts";

import { NEVER_EXCLUDED, STITCH } from "../../../fixtures/discovery.ts";

const HTML = `<body>
  <header data-mig-id="mig-1"><nav data-mig-id="mig-2"><a data-mig-id="mig-3">x</a></nav></header>
  <main data-mig-id="mig-4"><section data-mig-id="mig-5">hero</section></main>
</body>`;

describe("buildExcludedSet", () => {
  it("excludes chrome roots and their descendants, keeps content", () => {
    const excluded = buildExcludedSet(HTML, ["mig-1"]);
    expect(excluded("mig-1")).toBe(true);
    expect(excluded("mig-3")).toBe(true);
    expect(excluded("mig-5")).toBe(false);
    expect(excluded("mig-999")).toBe(false);
  });
});

describe("validateBlocksResponse", () => {
  it("passes a clean response", () => {
    const response = blocksResponseSchema.parse({
      route: "/",
      instances: [{ nodeIds: ["mig-5"], role: "hero", summary: "s" }],
    });
    expect(
      validateBlocksResponse({
        response,
        requestedRoute: "/",
        stitchIndex: STITCH,
        isExcluded: NEVER_EXCLUDED,
      }),
    ).toEqual([]);
  });

  it("flags route mismatch, hallucinated node, and excluded chrome", () => {
    const response = blocksResponseSchema.parse({
      route: "/",
      instances: [
        { nodeIds: ["mig-404"], role: "x", summary: "" },
        { nodeIds: ["mig-5"], role: "nav", summary: "" },
      ],
    });
    const errors = validateBlocksResponse({
      response,
      requestedRoute: "/about",
      stitchIndex: STITCH,
      isExcluded: (id) => id === "mig-5",
    });
    expect(errors.map((error) => error.code)).toEqual(["ROUTE_MISMATCH", "UNKNOWN_ID", "EXCLUDED_CHROME"]);
    expect(errors.find((error) => error.code === "UNKNOWN_ID")?.got).toBe("mig-404");
  });
});
