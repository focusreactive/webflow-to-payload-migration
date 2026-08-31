import { readTemplate } from "#generate/templates/read-template.ts";

describe("readTemplate", () => {
  // A call site that drops a slot would otherwise ship the raw token into the deliverable,
  // where it parses as a bare identifier and only the generate gates would catch it.
  it("refuses to render a template whose slot the call site forgot", async () => {
    await expect(readTemplate("globals/component-wrapper.tsx.tpl")).rejects.toThrow(/__NAME__|__SLUG__/);
    await expect(readTemplate("globals/component-wrapper.tsx.tpl", { NAME: "Header" })).rejects.toThrow(/__SLUG__/);
  });

  it("renders a template once every slot is passed", async () => {
    const rendered = await readTemplate("globals/component-wrapper.tsx.tpl", { NAME: "Header", SLUG: "header" });

    expect(rendered).toContain("Header");
    expect(rendered).toContain("header");
    expect(rendered).not.toMatch(/__[A-Z][A-Z0-9_]*__/);
  });
});
