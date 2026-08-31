import { allowedOriginEntries } from "#synth/steps/preflight/utils/allowed-origins.ts";

describe("allowedOriginEntries", () => {
  it("reads the semicolon-separated list off the inline flag form", () => {
    expect(allowedOriginEntries(["--headless", "--allowed-origins=localhost;localhost:*"])).toEqual([
      "localhost",
      "localhost:*",
    ]);
  });

  it("reads the two-token flag form", () => {
    expect(allowedOriginEntries(["--allowed-origins", "localhost:*", "--headless"])).toEqual(["localhost:*"]);
  });

  it("returns nothing when the lane declares no allowlist", () => {
    expect(allowedOriginEntries(["--headless"])).toEqual([]);
  });
});
