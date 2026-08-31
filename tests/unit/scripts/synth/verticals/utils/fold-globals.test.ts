import { foldGlobals } from "#synth/verticals/utils/fold-globals.ts";

describe("foldGlobals", () => {
  it("assembles per-entity schema + content shards into globals.json", () => {
    const data = foldGlobals([
      {
        name: "header",
        schema: { fields: [{ name: "logo", type: { type: "image" }, required: true }] },
        content: { values: { logo: "x.png" } },
      },
    ]);
    expect(data.globals[0]?.name).toBe("header");
    expect(data.globals[0]?.fields).toEqual([{ name: "logo", type: { type: "image" }, required: true }]);
    expect(data.globals[0]?.values).toEqual({ logo: "x.png" });
  });
});
