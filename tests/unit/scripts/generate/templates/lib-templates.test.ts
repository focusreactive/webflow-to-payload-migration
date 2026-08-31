import { readTemplate } from "#generate/templates/read-template.ts";

describe("lib templates", () => {
  it("resolves literal media through payload", async () => {
    const media = await readTemplate("lib/media-prop.ts.tpl");
    expect(media).toContain('findByID({ collection: "media", id: assetId })');
  });
});
