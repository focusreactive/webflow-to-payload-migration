import { readTemplate } from "#generate/templates/read-template.ts";

describe("seed/index.ts.tpl", () => {
  it("writes the chrome roles as payload globals, not as collections", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    expect(source).toContain("payload.updateGlobal(");
    expect(source).not.toContain('collection: "header"');
    expect(source).not.toContain('collection: "footer"');
  });

  it("seeds pages into the shell's own `pages` collection", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    expect(source).toContain('collection: "pages"');
    expect(source).not.toContain('collection: "page"');
  });

  it("passes no locale: the generated shell is single-locale", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    expect(source).not.toContain("I18N_CONFIG");
    expect(source).not.toContain("Locale");
  });

  it("is idempotent: every write looks the doc up before creating it", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    for (const collection of ["users", "media", "pages"]) {
      expect(source, collection).toContain(`collection: "${collection}"`);
    }
    expect(source).toContain("await payload.find({ collection: \"users\"");
    expect(source).toContain('where: { slug: { equals: slug } }');
  });

  // The IR stores a relationship as the target item's migration key, which only pass 1 can turn
  // into a doc id — so references are written in a second pass over what pass 1 recorded.
  it("resolves references in a second pass over the ids pass 1 recorded", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    const pass1At = source.indexOf("await seedItemsPass1(");
    const refsAt = source.indexOf("await seedItemRefsPass2(");
    expect(pass1At).toBeGreaterThan(-1);
    expect(refsAt).toBeGreaterThan(pass1At);
  });

  it("seeds media before anything that can reference it", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    const mediaAt = source.indexOf("await seedMedia(");
    const itemsAt = source.indexOf("await seedItemsPass1(");
    const pagesAt = source.indexOf("await seedPages(");
    const globalsAt = source.indexOf("await seedGlobals(");
    expect([mediaAt, itemsAt, pagesAt, globalsAt].every((at) => at >= 0)).toBe(true);
    expect(mediaAt).toBeLessThan(itemsAt);
    expect(itemsAt).toBeLessThan(pagesAt);
    expect(pagesAt).toBeLessThan(globalsAt);
  });

  it("converts richText via convertHTMLToLexical with JSDOM and rewrites img tags first", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    expect(source).toContain("convertHTMLToLexical");
    expect(source).toContain("editorConfigFactory");
    expect(source).toContain("JSDOM");
    expect(source).toContain("payloadDataForFields");
  });

  it("keeps the static layout literal-only", async () => {
    const source = await readTemplate("seed/index.ts.tpl");
    expect(source).toContain("literalOnly(");
  });
});
