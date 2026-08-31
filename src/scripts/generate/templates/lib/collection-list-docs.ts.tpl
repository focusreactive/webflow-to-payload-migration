import config from "@payload-config";
import { getPayload } from "payload";

import { collectionListBlocks } from "@/lib/migration/block-field-types";
import { collectionFieldTypes } from "@/lib/migration/collection-field-types";
import { normalizeDoc, type NormalizedDoc } from "@/lib/migration/normalize-values";

const ctx = {};
const DEFAULT_LIST_LIMIT = 12;

type BlockData = Record<string, unknown>;

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
    // Whatever the relationship did not populate arrives as a bare doc id.
    const ids = selected.filter(
      (entry): entry is string | number => typeof entry === "string" || typeof entry === "number",
    );
    if (ids.length > 0) {
      const payload = await getPayload({ config });
      const result = await payload.find({
        collection: collectionKey as never,
        where: { id: { in: ids } },
        depth: 2,
        limit: ids.length,
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
