import { mirrorPath, renderedPathFor, stylesPathFor } from "#lib/snapshot-store/paths.ts";

describe("mirrorPath", () => {
  describe("page", () => {
    it("mirrors a top-level route to a directory with index.html", () => {
      expect(mirrorPath("page", "https://example.com/about")).toBe("pages/about/index.html");
    });

    it("mirrors the root route to pages/index.html", () => {
      expect(mirrorPath("page", "https://example.com/")).toBe("pages/index.html");
    });

    it("mirrors each segment of a nested route as a directory", () => {
      expect(mirrorPath("page", "https://example.com/blog/post-1")).toBe("pages/blog/post-1/index.html");
    });

    it("sanitizes route segments (percent-encoded space becomes a clean dash)", () => {
      expect(mirrorPath("page", "https://example.com/My%20Page")).toBe("pages/my-page/index.html");
    });
  });

  describe("style", () => {
    it("uses the sanitized last path segment, dropping the query string", () => {
      expect(mirrorPath("style", "https://cdn.example.com/css/site.shared.58c9a8f78.min.css?v=1")).toBe(
        "styles/site.shared.58c9a8f78.min.css",
      );
    });
  });

  describe("script", () => {
    it("uses the scripts/ directory", () => {
      expect(mirrorPath("script", "https://cdn.example.com/js/app.a1b2c3.js")).toBe("scripts/app.a1b2c3.js");
    });
  });

  describe("data", () => {
    it("uses the data/ directory", () => {
      expect(mirrorPath("data", "https://cdn.example.com/data/searchIndex-abc123.json")).toBe(
        "data/searchindex-abc123.json",
      );
    });
  });

  describe("asset", () => {
    it("resolves a filename collision with a hash suffix from sanitizeFileName", () => {
      const existing = new Set(["photo.jpg"]);

      const path = mirrorPath("asset", "https://cdn.example.com/img/photo.jpg", { existing });

      expect(path).toMatch(/^assets\/media\/photo-[0-9a-f]{8}\.jpg$/);
    });

    it("is deterministic for the same URL and existing set", () => {
      const url = "https://cdn.example.com/img/photo.jpg";
      const existingA = new Set(["photo.jpg"]);
      const existingB = new Set(["photo.jpg"]);

      expect(mirrorPath("asset", url, { existing: existingA })).toBe(mirrorPath("asset", url, { existing: existingB }));
    });
  });
});

describe("renderedPathFor", () => {
  it("replaces the trailing index.html with index.rendered.html", () => {
    expect(renderedPathFor("pages/a/index.html")).toBe("pages/a/index.rendered.html");
  });

  it("handles the root page path", () => {
    expect(renderedPathFor("pages/index.html")).toBe("pages/index.rendered.html");
  });
});

describe("stylesPathFor", () => {
  it("replaces the trailing index.html with index.styles.json", () => {
    expect(stylesPathFor("pages/a/index.html")).toBe("pages/a/index.styles.json");
  });

  it("handles the root page path", () => {
    expect(stylesPathFor("pages/index.html")).toBe("pages/index.styles.json");
  });
});
