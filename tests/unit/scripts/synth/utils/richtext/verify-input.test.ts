import { describe, expect, it } from "vitest";

import { resolveRichTextRecord } from "#synth/utils/richtext/verify-input.ts";

describe("resolveRichTextRecord", () => {
  it("converts richText string fields to Lexical and leaves others untouched", async () => {
    const out = await resolveRichTextRecord(
      [
        { name: "body", type: { type: "richText" } },
        { name: "title", type: { type: "text" } },
      ],
      { body: "<h2>Hello</h2><p>World</p>", title: "Keep me" },
      { resolveImgSrc: () => undefined },
    );
    expect(out.title).toBe("Keep me");
    expect(typeof out.body).toBe("object");
    expect((out.body as { root?: unknown }).root).toBeDefined();
  });

  it("passes non-string richText through unchanged", async () => {
    const already = { root: { children: [] } };
    const out = await resolveRichTextRecord(
      [{ name: "body", type: { type: "richText" } }],
      { body: already },
      { resolveImgSrc: () => undefined },
    );
    expect(out.body).toBe(already);
  });
});
