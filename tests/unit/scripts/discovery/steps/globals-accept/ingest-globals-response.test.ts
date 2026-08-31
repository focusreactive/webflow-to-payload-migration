import { globalsResponseSchema } from "#discovery/schemas/globals-response.ts";
import { ingestGlobalsResponse } from "#discovery/steps/globals-accept/ingest-globals-response.ts";

describe("ingestGlobalsResponse", () => {
  it("mints a component id per global and keeps every node id on its exemplar", () => {
    const data = ingestGlobalsResponse({
      response: globalsResponseSchema.parse({
        source: "/",
        globals: [{ name: "header", nodeIds: ["mig-5", "mig-6"], corroboratedRoutes: [] }],
      }),
    });
    expect(data.types[0]?.name).toBe("header");
    expect(data.types[0]?.exemplar).toEqual({ route: "/", nodeIds: ["mig-5", "mig-6"] });
  });
});
