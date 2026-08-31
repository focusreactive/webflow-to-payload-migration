import { z } from "zod";

import { collectAssetIds, pruneNullValues, valueSchemaForFieldType } from "#ir/field-value.ts";
import type { BlockType } from "#ir/blocks.ts";

import type { MissedField } from "../../../schemas/layout-payload.ts";
import type { AcceptError, LayoutInstancePayload } from "../../../types.ts";

export function missedFieldErrors(missedFields: MissedField[]): AcceptError[] {
  return missedFields.map((missed, index) => ({
    code: "MISSED_FIELD",
    where: `missedFields.${index}`,
    got: missed.fieldName,
    detail: `collection "${missed.collectionKey}" needs a field like "${missed.fieldName}" (${missed.evidence})`,
    fix:
      `Re-run 'schema --force --collection ${missed.collectionKey}' with this evidence, then `
      + `'content --force --collection ${missed.collectionKey}', then this layout unit.`,
  }));
}

export function ingestInstanceFields(opts: {
  index: number;
  instance: LayoutInstancePayload;
  block: BlockType;
  knownAssetIds?: ReadonlySet<string>;
}): { fields: Record<string, unknown>; errors: AcceptError[] } {
  const fields: Record<string, unknown> = {};
  const errors: AcceptError[] = [];

  for (const field of opts.block.fields) {
    const raw = opts.instance.fields[field.name];
    if (raw === null || raw === undefined) continue;
    const where = `blocks.${opts.index}.fields.${field.name}`;
    const source = raw as { kind: "literal"; value: unknown };

    const value = pruneNullValues(source.value);
    const check = valueSchemaForFieldType(field.type).safeParse(value);
    if (!check.success) {
      errors.push({
        code: "FIELD_TYPE",
        where,
        got: value,
        detail: `literal value does not match the field type — ${z.prettifyError(check.error)}`,
        fix: `Write a value of type "${field.type.type}" for this field.`,
      });
      continue;
    }

    if (opts.knownAssetIds !== undefined) {
      for (const assetId of collectAssetIds(field.type, value)) {
        if (opts.knownAssetIds.has(assetId)) continue;
        errors.push({
          code: "UNKNOWN_ASSET_ID",
          where,
          got: assetId,
          detail: "this assetId is not in assets.json",
          fix: "Point the field at an assetId listed in assets.json.",
        });
      }
    }

    fields[field.name] = { kind: "literal", value };
  }

  return { fields, errors };
}
