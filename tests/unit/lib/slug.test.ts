import { slugifyId } from "#lib/slug.ts";

describe("slugifyId", () => {
  it("produces payload-safe custom ids", () => {
    expect(slugifyId("Hello, World!")).toBe("hello-world");
    expect(slugifyId("a/b.c")).toBe("a-b-c");
    expect(slugifyId("  Multi   Space  ")).toBe("multi-space");
    expect(slugifyId("Café déjà")).toBe("cafe-deja");
  });
  it("never returns an empty string", () => {
    expect(slugifyId("///").length).toBeGreaterThan(0);
  });
});
