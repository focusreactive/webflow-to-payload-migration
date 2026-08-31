import { classifyWebflowPage } from "#adapters/webflow/classify.ts";

function htmlWithTag(htmlTag: string): string {
  return `<!doctype html><html ${htmlTag}><head></head><body></body></html>`;
}

describe("classifyWebflowPage", () => {
  it("classifies a full item page: isWebflow true, kind item, all fields populated", () => {
    const html = htmlWithTag(
      'data-wf-domain="www.flowninja.com" data-wf-page="6995da87ed4c048591146911" data-wf-site="690b3bcdf6317aa397de2a16" lang="en" data-wf-collection="6995da87ed4c0485911468f9" data-wf-item-slug="10-common-webflow-problems-and-how-to-fix-them"',
    );

    const result = classifyWebflowPage(html);

    expect(result).toEqual({
      isWebflow: true,
      kind: "item",
      collectionKey: "6995da87ed4c0485911468f9",
      slug: "10-common-webflow-problems-and-how-to-fix-them",
      pageId: "6995da87ed4c048591146911",
      localeId: "en",
    });
  });

  it("classifies a static page (page+site, no collection) as kind static with no collectionKey", () => {
    const html = htmlWithTag(
      'data-wf-page="6995da87ed4c048591146911" data-wf-site="690b3bcdf6317aa397de2a16" lang="en"',
    );

    const result = classifyWebflowPage(html);

    expect(result).toEqual({
      isWebflow: true,
      kind: "static",
      pageId: "6995da87ed4c048591146911",
      localeId: "en",
    });
    expect("collectionKey" in result).toBe(false);
    expect("slug" in result).toBe(false);
  });

  it("flags a page carrying data-wf-site but no data-wf-page as not Webflow", () => {
    const html = htmlWithTag('data-wf-site="690b3bcdf6317aa397de2a16" lang="en"');

    const result = classifyWebflowPage(html);

    expect(result.isWebflow).toBe(false);
  });

  it('reads localeId from lang="fr"', () => {
    const html = htmlWithTag(
      'data-wf-page="6995da87ed4c048591146911" data-wf-site="690b3bcdf6317aa397de2a16" lang="fr"',
    );

    const result = classifyWebflowPage(html);

    expect(result.localeId).toBe("fr");
  });

  it("reports isWebflow false when neither data-wf-page nor data-wf-site is present", () => {
    const html = htmlWithTag('lang="en"');

    const result = classifyWebflowPage(html);

    expect(result.isWebflow).toBe(false);
    expect(result.kind).toBe("static");
  });

  it("omits localeId entirely when <html> has no lang attribute", () => {
    const html = htmlWithTag('data-wf-page="6995da87ed4c048591146911" data-wf-site="690b3bcdf6317aa397de2a16"');

    const result = classifyWebflowPage(html);

    expect("localeId" in result).toBe(false);
  });
});
