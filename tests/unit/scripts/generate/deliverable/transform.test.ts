import {
  collectAssetIdsFromValue,
  collectImgUrls,
  parseNdjson,
  partitionFields,
  payloadValueFor,
  rewriteImgTags,
  type SeedCtx,
} from "#generate/deliverable/seed/transform.ts";

const ctx: SeedCtx = {
  htmlToLexical: (html) => ({ lexical: html }),
  resolveAssetId: (url) => (url === "https://cdn.acme.example/hero.png" ? "a1f2a3b4c5d6e7f8" : undefined),
  mediaIdFor: (assetId) => (assetId === "a1f2a3b4c5d6e7f8" ? 42 : undefined),
  docIdFor: (collectionKey, migrationId) => (collectionKey === "works" && migrationId === "alpha" ? 7 : undefined),
  warn: () => {},
};

describe("payloadValueFor", () => {
  // Media is a base collection with an auto-increment id, so the migration's assetId is never the
  // doc id — the upload value has to be whatever id seedMedia created for that asset.
  it("maps MediaRef literals to the seeded media doc id", () => {
    expect(payloadValueFor({ type: "image" }, { assetId: "a1f2a3b4c5d6e7f8", alt: "x" }, ctx)).toBe(42);
    expect(payloadValueFor({ type: "video" }, { assetId: "a1f2a3b4c5d6e7f8" }, ctx)).toBe(42);
  });

  it("leaves an upload field empty and warns when the asset has no media doc", () => {
    const warnings: string[] = [];
    const value = payloadValueFor({ type: "image" }, { assetId: "ffffffffffffffff" }, { ...ctx, warn: (m) => warnings.push(m) });
    expect(value).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });

  it("rewrites img tags then converts richText html to lexical", () => {
    const html = '<p><img src="https://cdn.acme.example/hero.png" alt="Hero"></p>';
    const value = payloadValueFor({ type: "richText" }, html, ctx) as { lexical: string };
    expect(value.lexical).toContain('data-lexical-upload-id="42"');
    expect(value.lexical).toContain('data-lexical-upload-relation-to="media"');
  });

  it("wraps array elements into {item} rows and recurses groups", () => {
    const faq = {
      type: "array",
      element: {
        type: "group",
        fields: [{ name: "q", type: { type: "text" }, required: true }],
      },
    };
    expect(payloadValueFor(faq, [{ q: "Q1" }], ctx)).toEqual([{ item: { q: "Q1" } }]);
  });

  // Migrated collections have no custom id: an IR reference carries the migration item key, so
  // the seed has to swap it for the doc id Payload assigned in pass 1.
  it("resolves references to the seeded doc ids and keeps scalars as-is", () => {
    expect(payloadValueFor({ type: "reference", collectionKey: "works" }, "alpha", ctx)).toBe(7);
    expect(payloadValueFor({ type: "multiReference", collectionKey: "works" }, ["alpha"], ctx)).toEqual([7]);
    expect(payloadValueFor({ type: "number" }, 5, ctx)).toBe(5);
  });

  it("leaves a relationship empty and warns when the target item has no seeded doc", () => {
    const warnings: string[] = [];
    const warn = (message: string): void => void warnings.push(message);
    expect(payloadValueFor({ type: "reference", collectionKey: "works" }, "ghost", { ...ctx, warn })).toBeUndefined();
    expect(payloadValueFor({ type: "multiReference", collectionKey: "works" }, ["alpha", "ghost"], { ...ctx, warn })).toEqual([7]);
    expect(warnings).toHaveLength(2);
  });
});

describe("rewriteImgTags", () => {
  it("adds upload data attributes for known urls and warns on unknown", () => {
    const warnings: string[] = [];
    const html =
      '<img src="https://cdn.acme.example/hero.png"><img src="https://cdn.acme.example/unknown.png" alt="?">';
    const out = rewriteImgTags(
      html,
      (url) => {
        const assetId = ctx.resolveAssetId(url);
        return assetId === undefined ? undefined : ctx.mediaIdFor(assetId);
      },
      (m) => warnings.push(m),
    );
    expect(out).toContain('data-lexical-upload-id="42"');
    expect(out).not.toContain('unknown.png" data-lexical-upload-id');
    expect(warnings).toHaveLength(1);
  });
});

describe("ndjson + helpers", () => {
  it("parses meta line + bare records", () => {
    const parsed = parseNdjson('{"kind":"meta","schemaVersion":1}\n{"id":"a"}\n{"id":"b"}\n');
    expect(parsed.meta["schemaVersion"]).toBe(1);
    expect(parsed.records).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("splits ref fields for the two-pass seed", () => {
    const title = { name: "title", type: { type: "text" }, required: true };
    const author = { name: "author", type: { type: "reference", collectionKey: "people" }, required: false };
    const editors = { name: "editors", type: { type: "multiReference", collectionKey: "people" }, required: false };
    expect(partitionFields([title, author, editors])).toEqual({ plain: [title], refs: [author, editors] });
  });

  it("collects referenced asset ids and img urls", () => {
    expect(
      collectAssetIdsFromValue(
        { type: "array", element: { type: "image" } },
        [{ assetId: "a1f2a3b4c5d6e7f8" }],
      ),
    ).toEqual(["a1f2a3b4c5d6e7f8"]);
    expect(collectAssetIdsFromValue({ type: "video" }, { assetId: "a1f2a3b4c5d6e7f8" })).toEqual([
      "a1f2a3b4c5d6e7f8",
    ]);
    expect(collectImgUrls('<img src="https://x/1.png"><img src="https://x/2.png">')).toEqual([
      "https://x/1.png",
      "https://x/2.png",
    ]);
  });
});
