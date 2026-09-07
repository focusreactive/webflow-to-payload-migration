import { globalComponentDir } from "#generate/constants/paths.ts";

describe("global component staging", () => {
  it("stages chrome under the shared blocks artifacts dir", () => {
    expect(globalComponentDir("header")).toBe("global-header");
  });
});
