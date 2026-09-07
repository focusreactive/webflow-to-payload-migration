import { blockComponentName, blockDirName } from "#blocks/codegen/names.ts";
import { type BlocksData } from "#ir/blocks.ts";

export function emitRenderBlocksFile(blocks: BlocksData): string {
  const imports = blocks.blocks
    .map((block) => `import ${blockComponentName(block.id)} from "@/blocks/${blockDirName(block.id)}/Component";`)
    .join("\n");
  const mapEntries = blocks.blocks
    .map((block) => `  ${JSON.stringify(String(block.id))}: ${blockComponentName(block.id)},`)
    .join("\n");

  return `import config from "@payload-config";
import { getPayload } from "payload";
import React from "react";

import { blockFieldTypes, collectionListBlocks } from "@/lib/block-field-types";
import { collectionFieldTypes } from "@/lib/collection-field-types";
import { normalizeDoc, normalizeRecord, type NormalizedDoc } from "@/lib/normalize-values";
import { normalizeCtx as ctx } from "@/lib/normalize-ctx";

${imports}

const blockComponents = {
${mapEntries}
} as unknown as Record<string, React.ComponentType<Record<string, unknown>>>;

const DEFAULT_LIST_LIMIT = 12;

type BlockData = { blockType?: unknown } & Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function collectionListDocs(blockType: string, block: BlockData): Promise<NormalizedDoc[] | undefined> {
  const collectionKey = collectionListBlocks[blockType];
  if (collectionKey === undefined) return undefined;
  const fields = collectionFieldTypes[collectionKey] ?? [];

  if (block["populateBy"] === "selectedDocs" && Array.isArray(block["selectedDocs"])) {
    const selected = block["selectedDocs"] as unknown[];
    const docs = selected.filter(isRecord).map((doc) => normalizeDoc(fields, doc, ctx));
    const slugs = selected.filter((entry): entry is string => typeof entry === "string");
    if (slugs.length > 0) {
      const payload = await getPayload({ config });
      const result = await payload.find({
        collection: collectionKey as never,
        where: { id: { in: slugs } },
        depth: 2,
        limit: slugs.length,
      });
      docs.push(...result.docs.map((doc) => normalizeDoc(fields, doc as unknown as Record<string, unknown>, ctx)));
    }
    return docs;
  }

  const payload = await getPayload({ config });
  const limit = typeof block["limit"] === "number" ? block["limit"] : DEFAULT_LIST_LIMIT;
  const result = await payload.find({ collection: collectionKey as never, limit, sort: "id", depth: 2 });
  return result.docs.map((doc) => normalizeDoc(fields, doc as unknown as Record<string, unknown>, ctx));
}

export async function RenderBlocks(props: { blocks: unknown }): Promise<React.JSX.Element | null> {
  const { blocks } = props;
  if (!Array.isArray(blocks)) return null;

  const rendered = await Promise.all(
    blocks.map(async (raw, index) => {
      const block = raw as BlockData;
      const blockType = typeof block.blockType === "string" ? block.blockType : undefined;
      if (blockType === undefined) return null;
      const Component = blockComponents[blockType];
      const fields = blockFieldTypes[blockType];
      if (Component === undefined || fields === undefined) return null;
      const componentProps = normalizeRecord(fields, block, ctx);
      const docs = await collectionListDocs(blockType, block);
      return <Component key={index} {...componentProps} {...(docs !== undefined ? { docs } : {})} />;
    }),
  );

  return <React.Fragment>{rendered}</React.Fragment>;
}
`;
}
