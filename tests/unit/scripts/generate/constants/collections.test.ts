import { RESERVED_COLLECTION_KEYS } from "#generate/constants/collections.ts";

describe("RESERVED_COLLECTION_KEYS", () => {
  it("covers every collection the generated shell and this tool itself register", () => {
    for (const key of [
      "page",
      "pages",
      "media",
      "users",
      "header",
      "footer",
      "globalBlock",
      "redirects",
      "presets",
      "comments",
      "comment-reads",
      "ab-experiments",
      "payload-mcp-api-keys",
    ]) {
      expect(RESERVED_COLLECTION_KEYS.has(key), key).toBe(true);
    }
  });
});
