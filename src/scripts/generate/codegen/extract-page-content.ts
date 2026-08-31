import { type BlockField, type BlocksData } from "#ir/blocks.ts";
import { type FieldType } from "#ir/field-type.ts";

export interface ContentFieldPath {
  kind: "text" | "richText" | "upload";
  path: string[];
}

const KIND_BY_SCALAR: Record<string, ContentFieldPath["kind"] | undefined> = {
  text: "text",
  richText: "richText",
  image: "upload",
  file: "upload",
  video: "upload",
};

function pathsForType(type: FieldType, path: string[]): ContentFieldPath[] {
  if (type.type === "array") return pathsForType(type.element, path);
  if (type.type === "group") return type.fields.flatMap((field) => pathsForType(field.type, [...path, field.name]));
  const kind = KIND_BY_SCALAR[type.type];
  return kind === undefined ? [] : [{ kind, path }];
}

export function contentFieldPaths(fields: readonly BlockField[]): ContentFieldPath[] {
  return fields.flatMap((field) => pathsForType(field.type, [field.name]));
}

function emitSpec(blocks: BlocksData): string {
  return blocks.blocks
    .map((block) => {
      const fields = contentFieldPaths(block.fields)
        .map(
          (field) =>
            `{ kind: ${JSON.stringify(field.kind)}, path: [${field.path.map((s) => JSON.stringify(s)).join(", ")}] }`,
        )
        .join(",\n    ");
      return `  ${JSON.stringify(String(block.id))}: [\n    ${fields},\n  ],`;
    })
    .join("\n");
}

export function emitExtractPageContentFile(blocks: BlocksData): string {
  return `import { paragraph } from "@focus-reactive/payload-plugin-seo/content";
import type { ContentExtractor, ContentNode, DocQuery, DocStore } from "@focus-reactive/payload-plugin-seo/content";

import { I18N_CONFIG } from "@/lib/config/i18n";
import { asArray, buildRefQueries, relationId, richTextToContent, uploadImage } from "@/lib/contentExtraction";
import type { LinkResolveCtx, UploadField } from "@/lib/contentExtraction";
import type { GlobalBlock, Page } from "@/payload-types";

type Block = Page["blocks"][number];
type GlobalBlockContent = NonNullable<GlobalBlock["block"]>[number];

interface ContentField {
  kind: "text" | "richText" | "upload";
  path: string[];
}

// The content-bearing fields of every migrated block, in schema order. Generated from the block
// IR: the upstream original hand-mapped the boilerplate's own blocks, which no longer exist here.
const CONTENT_FIELDS_BY_BLOCK: Record<string, ContentField[]> = {
${emitSpec(blocks)}
};

// Array values are seeded as \`{ item: value }\` rows, so an array unwraps into its rows' items
// before the remaining path segments apply.
function valuesAtPath(value: unknown, path: readonly string[]): unknown[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((row) => valuesAtPath((row as { item?: unknown })?.item, path));
  }
  if (path.length === 0) return [value];
  if (typeof value !== "object") return [];
  const [head, ...rest] = path;
  return valuesAtPath((value as Record<string, unknown>)[head as string], rest);
}

export function extractPageBlockContent(
  block: Block,
  ctx: LinkResolveCtx,
  docs: DocStore,
  helpers: { compact: (n: (ContentNode | null | undefined)[]) => ContentNode[] },
): ContentNode[] {
  // Compared as a string rather than switched on: "globalSectionSlot" comes from the base's own
  // Page config, not from the block IR, so it is not always part of the generated union.
  const blockType: string = block.blockType;

  if (blockType === "globalSectionSlot") {
    const id = relationId((block as { reference?: unknown }).reference);
    const resolved =
      id === null ? undefined : (docs.get("globalBlock", id) as { block?: GlobalBlockContent[] } | undefined);
    const inner = resolved?.block?.[0];
    return inner === undefined ? [] : extractPageBlockContent(inner as unknown as Block, ctx, docs, helpers);
  }

  const nodes: (ContentNode | null | undefined)[] = [];
  for (const field of CONTENT_FIELDS_BY_BLOCK[blockType] ?? []) {
    for (const value of valuesAtPath(block, field.path)) {
      if (field.kind === "text") nodes.push(paragraph(value as string));
      else if (field.kind === "upload") nodes.push(uploadImage(value as UploadField, docs));
      else nodes.push(...richTextToContent(value, ctx));
    }
  }
  return helpers.compact(nodes);
}

function collectGlobalBlockIds(blocks: Block[]): (string | number)[] {
  const ids = new Set<string | number>();

  for (const block of blocks) {
    if ((block.blockType as string) !== "globalSectionSlot") continue;
    const id = relationId((block as { reference?: unknown }).reference);
    if (id !== null) ids.add(id);
  }

  return [...ids];
}

function mergeStores(...stores: (DocStore | null)[]): DocStore {
  return {
    get: (collection, id) => {
      for (const store of stores) {
        const doc = store?.get(collection, id);
        if (doc) return doc;
      }
      return undefined;
    },
  };
}

const extractPageContent: ContentExtractor = async (values, ctx, { resolveDocs, helpers }) => {
  const blocks = asArray<Block>((values as { blocks?: unknown }).blocks);
  const locale = ctx.locale ?? I18N_CONFIG.defaultLocale;

  const globalIds = collectGlobalBlockIds(blocks);
  const phase1Queries: DocQuery[] = [...buildRefQueries(values)];
  if (globalIds.length > 0) {
    phase1Queries.push({ collection: "globalBlock", ids: globalIds, select: ["block"], depth: 0 });
  }
  const docs1: DocStore = await resolveDocs(phase1Queries);

  const globalDocs = globalIds
    .map((id) => docs1.get("globalBlock", id))
    .filter((doc): doc is Record<string, unknown> => doc !== undefined && doc !== null);
  const phase2Queries: DocQuery[] = globalDocs.flatMap((doc) => buildRefQueries(doc));
  const docs2: DocStore | null = phase2Queries.length > 0 ? await resolveDocs(phase2Queries) : null;

  const docs = mergeStores(docs1, docs2);
  const linkCtx: LinkResolveCtx = { docs, locale };

  return blocks.flatMap((block) => extractPageBlockContent(block, linkCtx, docs, helpers));
};

export default extractPageContent;
`;
}
