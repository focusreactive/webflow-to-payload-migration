import { collectionIdSchema } from "#ir/common.ts";
import { collectionSchema } from "#ir/schema.ts";
import {
  collectionConfigName,
  collectionFileName,
  emitCmsCollectionFile,
  pascalCase,
  RESERVED_COLLECTION_KEYS,
} from "#generate/codegen/collections.ts";

const works = collectionSchema.parse({
  key: "case-studies",
  label: "Case studies",
  slugField: "slug",
  fields: [
    { name: "slug", type: { type: "text" }, required: true },
    { name: "title", type: { type: "text" }, required: true },
    { name: "cover", type: { type: "image" }, required: false },
    { name: "author", type: { type: "reference", collectionKey: "people" }, required: false },
    { name: "editors", type: { type: "multiReference", collectionKey: "people" }, required: true },
  ],
});

describe("cms collection emit", () => {
  it("derives names", () => {
    expect(pascalCase("case-studies")).toBe("CaseStudies");
    expect(collectionConfigName("case-studies")).toBe("CaseStudiesCollection");
    expect(collectionFileName("case-studies")).toBe("CaseStudies.ts");
  });

  // A declared `id` text field would make it Payload's primary key and an editor-facing required
  // field duplicating the slug; the docs keep Payload's own id and the seed keys them by slug.
  it("emits no id field, plus useAsTitle and the mapped fields", () => {
    const file = emitCmsCollectionFile(works);
    expect(file).toContain('import type { CollectionConfig } from "payload"');
    expect(file).toContain("export const CaseStudiesCollection: CollectionConfig");
    expect(file).toContain('"slug": "case-studies"');
    expect(file).not.toContain('"name": "id"');
    expect(file).toContain('"useAsTitle": "slug"');
    expect(file).toContain('"relationTo": "people"');
  });

  it("uses the passed slug (not a digit-leading Webflow key) for the identifier, file name and slug", () => {
    const webflowKeyed = collectionSchema.parse({
      key: "66bb55828d7895b95652e006",
      label: "Works",
      slugField: "slug",
      fields: [
        { name: "slug", type: { type: "text" }, required: true },
        { name: "author", type: { type: "reference", collectionKey: "77aa11112222333344445555" }, required: false },
      ],
    });
    const slugFor = (key: string): string => ({ "77aa11112222333344445555": "people" })[key] ?? key;
    const file = emitCmsCollectionFile(webflowKeyed, "works", slugFor);
    expect(collectionConfigName("works")).toBe("WorksCollection");
    expect(collectionFileName("works")).toBe("Works.ts");
    expect(file).toContain("export const WorksCollection: CollectionConfig");
    expect(file).toContain('"slug": "works"');
    // digit-leading identifiers must never appear
    expect(file).not.toMatch(/\b66bb/);
    // reference relationTo resolves through the slug map
    expect(file).toContain('"relationTo": "people"');
  });

  it("strips required from relationship fields but keeps it on plain fields (two-pass seed)", () => {
    const file = emitCmsCollectionFile(works);
    const match = file.match(/\.\.\.\((\{[\s\S]*\})\s*as Omit</);
    expect(match).not.toBeNull();
    const body = JSON.parse(match![1] ?? "") as { fields: { name: string; type: string; required?: boolean }[] };
    const editors = body.fields.find((f) => f.name === "editors");
    const title = body.fields.find((f) => f.name === "title");
    expect(editors).toBeDefined();
    expect(editors!.type).toBe("relationship");
    expect(editors!.required).toBeUndefined();
    expect(title).toBeDefined();
    expect(title!.required).toBe(true);
  });
});

describe("emitCmsCollectionFile", () => {
  it("uses the shared access helpers and admin grouping", () => {
    const source = emitCmsCollectionFile(
      {
        key: collectionIdSchema.parse("works"),
        label: "Works",
        fields: [{ name: "title", type: { type: "text" }, required: true }],
      },
      "works",
    );

    expect(source).toContain('import { anyone, or, superAdmin, user } from "@/lib/access";');
    expect(source).toContain("read: anyone");
    expect(source).toContain("create: or(superAdmin, user)");
    // the body is emitted via JSON.stringify, so keys are quoted like every other
    // assertion in this file (see "uses the passed slug..." above)
    expect(source).toContain('"group": "Content"');
    expect(source).toContain('"useAsTitle": "title"');
  });

  it("localizes content-bearing fields and leaves uploads and references alone", () => {
    const source = emitCmsCollectionFile(
      {
        key: collectionIdSchema.parse("works"),
        label: "Works",
        fields: [
          { name: "title", type: { type: "text" }, required: true },
          { name: "body", type: { type: "richText" }, required: false },
          // an image field stands in for a non-text, non-relationship scalar (the brief's
          // fixture used a nonexistent "media" FieldType; #ir/field-type.ts has no such
          // scalar, so "image" is the closest real analogue and is likewise never localized)
          { name: "hero", type: { type: "image" }, required: false },
          {
            name: "author",
            type: { type: "reference", collectionKey: collectionIdSchema.parse("people") },
            required: false,
          },
          // an option field's stored value is a fixed enum key (e.g. "draft"), not display
          // text — it must not be localized either
          { name: "status", type: { type: "option", values: ["draft", "published"] }, required: false },
        ],
      },
      "works",
      (key) => key,
    );

    const parsed = source.slice(source.indexOf("{"), source.lastIndexOf("}") + 1);
    expect(parsed).toContain('"localized": true');
    expect(source.match(/"localized": true/gu)).toHaveLength(2);
  });
});

describe("RESERVED_COLLECTION_KEYS", () => {
  it("covers every collection the generated shell registers", () => {
    for (const key of [
      "page",
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
