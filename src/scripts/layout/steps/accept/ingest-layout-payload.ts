import { layoutRecordSchema, type LayoutRecord } from "#ir/layout.ts";
import type { BlockType } from "#ir/blocks.ts";

import { buildLayoutPayloadSchema } from "../../schemas/layout-payload.ts";
import type { AcceptError, LayoutPayload } from "../../types.ts";
import { schemaErrors } from "../../utils/schema-errors.ts";

import { validateLayoutPayload } from "./validate-layout-payload.ts";
import { ingestInstanceFields, missedFieldErrors } from "./utils/ingest-layout-payload.ts";

export function ingestLayoutPayload(opts: {
  route: string;
  response: unknown;
  blocks: BlockType[];
  knownMigIds: ReadonlySet<string>;
  knownAssetIds?: ReadonlySet<string>;
}): { ok: true; records: LayoutRecord[] } | { ok: false; errors: AcceptError[] } {
  const parsed = buildLayoutPayloadSchema({ route: opts.route, blocks: opts.blocks }).safeParse(opts.response);
  if (!parsed.success) return { ok: false, errors: schemaErrors(parsed.error.issues) };
  const payload = parsed.data as LayoutPayload;

  const blocksById = new Map(opts.blocks.map((block) => [String(block.id), block]));
  const errors: AcceptError[] = [
    ...validateLayoutPayload({ payload, knownMigIds: opts.knownMigIds, blocksById }),
    ...missedFieldErrors(payload.missedFields),
  ];

  const records: LayoutRecord[] = [];
  payload.blocks.forEach((instance, index) => {
    const block = blocksById.get(instance.blockType);
    if (block === undefined) return;

    const ingested = ingestInstanceFields({
      index,
      instance,
      block,
      ...(opts.knownAssetIds !== undefined ? { knownAssetIds: opts.knownAssetIds } : {}),
    });
    errors.push(...ingested.errors);

    records.push({
      order: index,
      blockType: instance.blockType,
      anchorMigId: instance.anchorMigId,
      fields: ingested.fields,
      _provenance: "ai",
      _confidence: instance.confidence,
    } as unknown as LayoutRecord);
  });

  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, records: records.map((record) => layoutRecordSchema.parse(record)) };
}
