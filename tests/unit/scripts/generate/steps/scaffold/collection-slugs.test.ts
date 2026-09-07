import { collectionSchema } from "#ir/schema.ts";
import {
  buildCollectionSlugMap,
  collectionSlug,
  emitCollectionSlugsFile,
} from "#generate/steps/scaffold/collection-slugs.ts";

const collection = (key: string, label: string) =>
  collectionSchema.parse({
    key,
    label,
    slugField: "slug",
    fields: [{ name: "slug", type: { type: "text" }, required: true }],
  });

describe("collectionSlug", () => {
  it("derives a readable slug from the label", () => {
    expect(collectionSlug({ key: "66bb55828d7895b95652e006", label: "Works" })).toBe("works");
    expect(collectionSlug({ key: "x", label: "Case Studies" })).toBe("case-studies");
  });

  it("guarantees a letter-leading slug for digit-leading labels/keys", () => {
    expect(collectionSlug({ key: "66bb55828d7895b95652e006", label: "2024 Recap" })).toBe("c-2024-recap");
    expect(collectionSlug({ key: "66bb55828d7895b95652e006", label: "" })).toBe("c-66bb55828d7895b95652e006");
  });
});

describe("buildCollectionSlugMap", () => {
  it("maps each Webflow key to its slug", () => {
    const { map } = buildCollectionSlugMap([collection("66bb55828d7895b95652e006", "Works")]);
    expect(map.get("66bb55828d7895b95652e006")).toBe("works");
  });

  it("disambiguates colliding slugs deterministically", () => {
    const { map, warnings } = buildCollectionSlugMap([collection("a", "Team"), collection("b", "Team")]);
    expect(map.get("a")).toBe("team");
    expect(map.get("b")).toBe("team-2");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("another migrated collection");
  });

  it("avoids the built-in collection slugs", () => {
    const { map, warnings } = buildCollectionSlugMap([collection("a", "Pages")]);
    expect(map.get("a")).toBe("pages-2");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("reserved collection");
  });

  it("disambiguates a label that slugifies onto a single-word reserved collection (e.g. Header) and warns", () => {
    const { map, warnings } = buildCollectionSlugMap([collection("a", "Header")]);
    expect(map.get("a")).toBe("header-2");
    expect(warnings).toEqual([
      'collection "a": slug "header" collides with a reserved collection; '
        + 'renamed to "header-2" (its URLs use "header-2", not "header")',
    ]);
  });

  it("disambiguates a label that slugifies onto a dash-form reserved collection (e.g. comment-reads)", () => {
    const { map, warnings } = buildCollectionSlugMap([collection("a", "Comment Reads")]);
    expect(map.get("a")).toBe("comment-reads-2");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("reserved collection");
  });

  it("does not warn when no collision occurs", () => {
    const { warnings } = buildCollectionSlugMap([collection("a", "Works")]);
    expect(warnings).toEqual([]);
  });
});

describe("emitCollectionSlugsFile", () => {
  it("emits a typed key->slug record", () => {
    const file = emitCollectionSlugsFile(new Map([["66bb55828d7895b95652e006", "works"]]));
    expect(file).toContain("export const collectionSlugs: Record<string, string>");
    expect(file).toContain('"66bb55828d7895b95652e006": "works"');
  });
});
