import {
  normalizeDoc,
  normalizeProps,
  normalizeRecord,
  normalizeValue,
  type FieldDef,
  type NormalizeCtx,
} from "#generate/deliverable/lib/migration/normalize-values.ts";

const ctx: NormalizeCtx = {};

describe("normalizeValue", () => {
  it("maps populated upload docs to the verified MediaProp shape", () => {
    expect(normalizeValue({ type: "image" }, { id: "a1", url: "/api/media/file/x.png", alt: "Logo" }, ctx)).toEqual({
      src: "/api/media/file/x.png",
      alt: "Logo",
    });
    expect(normalizeValue({ type: "image" }, { id: "a1", url: "/u.png", alt: null }, ctx)).toEqual({ src: "/u.png" });
    expect(normalizeValue({ type: "video" }, { id: "a2", url: "/api/media/file/hero.mp4" }, ctx)).toEqual({
      src: "/api/media/file/hero.mp4",
    });
    // Unpopulated (string id) uploads cannot be resolved to a URL at render time.
    expect(normalizeValue({ type: "image" }, "a1", ctx)).toBeUndefined();
  });

  it("returns richText lexical state verbatim (no HTML conversion)", () => {
    const lexical = { root: { children: [] } };
    expect(normalizeValue({ type: "richText" }, lexical, ctx)).toBe(lexical);
    expect(normalizeValue({ type: "richText" }, null, ctx)).toBeUndefined();
  });

  // Docs carry Payload's own id, so a populated relationship yields its slug — the human-readable
  // key components build hrefs from. Only an unpopulated one falls back to the raw id.
  it("maps relationships to slugs whether populated or not", () => {
    expect(normalizeValue({ type: "reference", collectionKey: "works" }, { id: 7, slug: "alpha" }, ctx)).toBe("alpha");
    expect(normalizeValue({ type: "reference", collectionKey: "works" }, "alpha", ctx)).toBe("alpha");
    expect(normalizeValue({ type: "reference", collectionKey: "works" }, { id: 7 }, ctx)).toBe("7");
    expect(
      normalizeValue({ type: "multiReference", collectionKey: "works" }, [{ id: 1, slug: "a" }, "b"], ctx),
    ).toEqual(["a", "b"]);
  });

  it("unwraps array rows ({item}) and recurses groups", () => {
    const faq = {
      type: "array",
      element: {
        type: "group",
        fields: [
          { name: "q", type: { type: "text" }, required: true },
          { name: "a", type: { type: "richText" }, required: false },
        ],
      },
    };
    expect(
      normalizeValue(faq, [{ id: "row1", item: { q: "Q1", a: { root: {} } } }], ctx),
    ).toEqual([{ q: "Q1", a: { root: {} } }]);
  });

  it("passes scalars and option values through", () => {
    expect(normalizeValue({ type: "number" }, 3, ctx)).toBe(3);
    expect(normalizeValue({ type: "option", values: ["red"] }, "red", ctx)).toBe("red");
  });
});

describe("normalizeRecord / normalizeDoc", () => {
  const fields: FieldDef[] = [
    { name: "title", type: { type: "text" }, required: true },
    { name: "cover", type: { type: "image" }, required: false },
  ];

  it("walks only declared fields and drops absent values", () => {
    const record = normalizeRecord(fields, { title: "Hi", createdAt: "2026-01-01" }, ctx);
    expect(record).toEqual({ title: "Hi" });
  });

  it("normalizeDoc keeps the doc id as a string", () => {
    const doc = normalizeDoc(fields, { id: "alpha", title: "Hi" }, ctx);
    expect(doc).toEqual({ id: "alpha", title: "Hi" });
  });
});

describe("normalizeProps", () => {
  it("types the normalized record as the generated props interface", () => {
    interface HeroProps {
      heading: string;
      cover?: { src: string };
    }
    const fields: FieldDef[] = [
      { name: "heading", type: { type: "text" }, required: true },
      { name: "cover", type: { type: "image" }, required: false },
    ];

    const props = normalizeProps<HeroProps>(fields, { heading: "Hi", cover: { url: "/c.png" }, extra: 1 }, ctx);

    expect(props).toEqual({ heading: "Hi", cover: { src: "/c.png" } });
    expect(props.heading).toBe("Hi");
  });
});
