import { blocksDataSchema } from "#ir/blocks.ts";
import { globalsDataSchema } from "#ir/globals.ts";
import { collectionSchema } from "#ir/schema.ts";
import {
  emitBlockFieldTypesFile,
  emitGlobalFieldTypesFile,
  emitCollectionFieldTypesFile,
  fieldDefsFor,
} from "#generate/steps/scaffold/field-type-maps.ts";

describe("fieldDefsFor", () => {
  it("projects slug/type/required and drops labels", () => {
    expect(fieldDefsFor([{ name: "title", label: "Title", type: { type: "text" }, required: true } as never])).toEqual([
      { name: "title", type: { type: "text" }, required: true },
    ]);
  });
});

describe("emitters", () => {
  it("emits blockFieldTypes plus the collection-list registry", () => {
    const blocks = blocksDataSchema.parse({
      blocks: [
        {
          id: "works-grid",
          name: "Works grid",
          fields: [{ name: "limit", type: { type: "number" }, required: false }],
          collectionKey: "works",
          content: {},
        },
      ],
    });
    const file = emitBlockFieldTypesFile(blocks);
    expect(file).toContain('import type { FieldDef } from "./normalize-values"');
    expect(file).toContain("export const blockFieldTypes: Record<string, FieldDef[]>");
    expect(file).toContain('"works-grid"');
    expect(file).toContain(
      'export const collectionListBlocks: Record<string, string> = {\n  "works-grid": "works"\n};',
    );
  });

  it("emits collection and chrome field types", () => {
    const collections = [
      collectionSchema.parse({
        key: "works",
        label: "Works",
        slugField: "slug",
        fields: [{ name: "title", type: { type: "text" }, required: true }],
      }),
    ];
    expect(emitCollectionFieldTypesFile(collections)).toContain('"works"');
    const globals = globalsDataSchema.parse({
      globals: [
        {
          name: "header",
          fields: [{ name: "logo", type: { type: "image" }, required: true }],
          values: {},
        },
      ],
    });
    expect(emitGlobalFieldTypesFile(globals)).toContain("export const globalFieldTypes");
  });
});
