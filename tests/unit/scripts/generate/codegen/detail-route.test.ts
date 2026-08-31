import {
  assertNoBaseRouteCollision,
  detailRoutePath,
  emitDetailWrapper,
} from "#generate/codegen/detail-route.ts";

describe("detailRoutePath", () => {
  it("lays the route flat under (frontend), with no locale segment", () => {
    expect(detailRoutePath("/works/:slug")).toBe("src/app/(frontend)/works/[slug]/page.tsx");
    expect(detailRoutePath("/case-studies/:slug")).toBe("src/app/(frontend)/case-studies/[slug]/page.tsx");
  });
});

describe("assertNoBaseRouteCollision", () => {
  it("rejects a pattern that shadows a segment the generated shell owns", () => {
    expect(() => assertNoBaseRouteCollision("/api/:slug")).toThrow(/api/);
    expect(() => assertNoBaseRouteCollision("/admin/:slug")).toThrow(/admin/);
    expect(() => assertNoBaseRouteCollision("/works/:slug")).not.toThrow();
  });
});

describe("emitDetailWrapper", () => {
  it("resolves the doc by slug alone, with no locale in the params", () => {
    const source = emitDetailWrapper({
      collectionKey: "works",
      collectionSlug: "works",
      pageBinding: { slugField: "slug", meta: {} },
      template: [{ sectionId: "hero" }],
    });

    expect(source).toContain("params: Promise<{ slug: string }>");
    expect(source).not.toContain("Locale");
    expect(source).not.toContain("I18N_CONFIG");
    expect(source).toContain('collection: "works"');
  });

  it("imports and renders every section in the template, in order", () => {
    const source = emitDetailWrapper({
      collectionKey: "blog",
      collectionSlug: "blog",
      pageBinding: { slugField: "title", meta: {} },
      template: [{ sectionId: "hero" }, { sectionId: "post-body" }],
    });

    expect(source).toContain('import Hero from "@/detail/blog/sections/Hero";');
    expect(source).toContain('import PostBody from "@/detail/blog/sections/PostBody";');
    expect(source).toContain("<Hero doc={doc} />");
    expect(source).toContain("<PostBody doc={doc} />");
    expect(source).toContain("if (!doc) notFound();");
  });

  it("quotes the slug field as a computed key in every where/bracket access, never as a bare identifier", () => {
    // Webflow field slugs are conventionally kebab-case; a bare-identifier splice would
    // produce a syntax error for a slug field like "seo-slug".
    const source = emitDetailWrapper({
      collectionKey: "works",
      collectionSlug: "works",
      pageBinding: { slugField: "seo-slug", meta: {} },
      template: [{ sectionId: "hero" }],
    });

    expect(source).toContain('where: { ["seo-slug"]: { equals: slug } }');
    expect(source).toContain('entry["seo-slug"]');
    expect(source).not.toMatch(/where:\s*{\s*seo-slug:/);
  });

  it("restores generateMetadata from pageBinding.meta", () => {
    const source = emitDetailWrapper({
      collectionKey: "blog",
      collectionSlug: "blog",
      pageBinding: {
        slugField: "title",
        meta: { title: "title", description: "excerpt", ogImage: "cover" },
      },
      template: [{ sectionId: "hero" }],
    });

    expect(source).toContain("export async function generateMetadata({ params }: Args): Promise<Metadata>");
    expect(source).toContain('title: item?.["title"] as string | undefined,');
    expect(source).toContain('description: item?.["excerpt"] as string | undefined,');
    expect(source).toContain('openGraph: { images: item?.["cover"] ? [String(item["cover"])] : [] },');
  });

  it("omits metadata keys that pageBinding.meta does not map, without emitting invalid syntax", () => {
    const source = emitDetailWrapper({
      collectionKey: "works",
      collectionSlug: "works",
      pageBinding: { slugField: "slug", meta: {} },
      template: [{ sectionId: "hero" }],
    });

    expect(source).toContain("export async function generateMetadata({ params }: Args): Promise<Metadata> {");
    expect(source).not.toContain("item?.[");
  });
});
