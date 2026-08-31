import { readTemplate } from "#generate/templates/read-template.ts";

describe("seed/index.ts.tpl", () => {
  it("disables revalidation on every write", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    const writes = source.match(/payload\.(create|update)\(/gu) ?? [];
    const contexts = source.match(/context: SEED_CONTEXT/gu) ?? [];
    expect(writes.length).toBeGreaterThan(0);
    expect(contexts.length).toBeGreaterThanOrEqual(writes.length);
  });

  it("resolves the migration root by walking up", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    expect(source).toContain("findMigrationRoot");
    expect(source).not.toContain('path.join(".migration", "artifacts")');
  });

  // A published page with no blocks fails the base collection's `required: true` and aborts the
  // whole seed, so a route whose layout artifact is missing has to stay a draft like a container.
  it("publishes a page only when it has both a route and blocks", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    expect(source).toContain('node.route !== null && blocksData.length > 0 ? "published" : "draft"');
  });

  // The base's Users.name is `required: true` with `defaultValue: ""`, and Payload's required
  // check rejects the empty default — the admin create has to carry a name of its own.
  // Users.name and Users.role are both required in the generated types (a defaultValue does not
  // relax them), so an admin create without either fails validation and the typecheck gate.
  it("gives the seeded admin a name and a role", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    expect(source).toContain('data: { email, password, name: "Admin", role: "admin" }');
  });

  // The base's Media has an auto-increment id, so the seed cannot store the assetId as the doc id:
  // it keys media by the uploaded filename and hands later passes the real doc ids.
  it("creates media without a custom id and resolves uploads through the seeded ids", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    expect(source).not.toContain('data: { id: assetId, alt: altFor(asset) }');
    expect(source).toContain("filename: { equals: filename }");
    expect(source).toContain("mediaIdFor");
  });

  it("no longer writes payload globals", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    expect(source).not.toContain("updateGlobal");
  });

  it("seeds media before chrome and chrome before the page tree", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    // Chrome docs carry media relationships Payload validates by id, and a page carries the
    // chrome relationship ids seedChrome returns.
    const mediaAt = source.indexOf("await seedMedia(");
    const itemsAt = source.indexOf("await seedItemsPass1(");
    const refsAt = source.indexOf("await seedItemRefsPass2(");
    const chromeAt = source.indexOf("await seedChrome(");
    const treeAt = source.indexOf("await seedPageTree(");
    expect([mediaAt, itemsAt, refsAt, chromeAt, treeAt].every((at) => at >= 0)).toBe(true);
    expect(mediaAt).toBeLessThan(itemsAt);
    expect(itemsAt).toBeLessThan(refsAt);
    expect(refsAt).toBeLessThan(chromeAt);
    expect(chromeAt).toBeLessThan(treeAt);
  });

  it("converts richText via convertHTMLToLexical with JSDOM and rewrites img tags first", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    expect(source).toContain("convertHTMLToLexical");
    expect(source).toContain("editorConfigFactory.default");
    expect(source).toContain("JSDOM");
    expect(source).toContain("payloadDataForFields");
  });

  // Migrated collections carry no custom id, so a re-run recognises an item by its slug field and
  // lets Payload keep owning the doc id.
  it("keys item idempotency on the collection slug field, not a custom id", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    expect(source).not.toContain("assertValidCustomId");
    expect(source).toContain("collection.pageBinding.slugField");
    expect(source).toContain("where: { [slugField]: { equals: slugValue } }");
  });

  // The IR stores a relationship as the target item's migration key, which only pass 1 can turn
  // into a doc id — so every later pass resolves references through the ids it recorded.
  it("resolves references through the doc ids pass 1 recorded", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    expect(source).toContain("docIdFor:");
    const pass1At = source.indexOf("await seedItemsPass1(");
    const refsAt = source.indexOf("await seedItemRefsPass2(");
    expect(pass1At).toBeGreaterThan(-1);
    expect(refsAt).toBeGreaterThan(pass1At);
  });

  it("keeps the static layout literal-only", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    expect(source).toContain("literalOnly(");
  });
});
