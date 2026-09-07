import { pascalCase } from "#generate/steps/scaffold/utils/names.ts";

describe("pascalCase", () => {
  it("joins the segments of a kebab-cased key", () => {
    expect(pascalCase("case-studies")).toBe("CaseStudies");
  });
});
