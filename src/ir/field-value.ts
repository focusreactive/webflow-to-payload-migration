import { z } from "zod";

import { mediaRefSchema } from "#ir/common.ts";
import type { FieldType, GroupField, ScalarType } from "#ir/field-type.ts";

export function valueSchemaForFieldType(fieldType: FieldType): z.ZodType {
  switch (fieldType.type) {
    case "array":
      return z.array(valueSchemaForFieldType(fieldType.element));
    case "group":
      return groupValueSchema(fieldType.fields, valueSchemaForFieldType, "optional");
    case "reference":
      return z.string().min(1);
    case "multiReference":
      return z.array(z.string().min(1));
    case "option": {
      const allowed = new Set(fieldType.values);
      return z.string().refine((value) => allowed.has(value), {
        message: `must be one of: ${fieldType.values.join(", ")}`,
      });
    }
    case "unsupported":
      return z.string();
    default:
      return scalarValueSchema(fieldType.type);
  }
}

export function llmValueSchemaForFieldType(fieldType: FieldType): z.ZodType {
  switch (fieldType.type) {
    case "array":
      return z.array(llmValueSchemaForFieldType(fieldType.element));
    case "group":
      return groupValueSchema(fieldType.fields, llmValueSchemaForFieldType, "nullable");
    case "image":
    case "file":
    case "video":
      return z.object({ assetId: z.string().min(1), alt: z.string().nullable() });
    default:
      return valueSchemaForFieldType(fieldType);
  }
}

function groupValueSchema(
  fields: GroupField[],
  resolve: (fieldType: FieldType) => z.ZodType,
  absence: "optional" | "nullable",
): z.ZodType {
  const shape: Record<string, z.ZodType> = {};

  for (const field of fields) {
    const value = resolve(field.type);
    shape[field.name] =
      field.required ? value
      : absence === "optional" ? value.optional()
      : z.union([value, z.null()]);
  }

  return absence === "optional" ? z.strictObject(shape) : z.object(shape);
}

const ISO_DATE_MESSAGE =
  'date field value must be ISO-8601 (e.g. "2025-08-12T00:00:00.000Z") — display formatting belongs '
  + "in Component.tsx, not in the stored value";

function scalarValueSchema(scalar: ScalarType): z.ZodType {
  switch (scalar) {
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "date":
      return z.iso.datetime({ offset: true, error: ISO_DATE_MESSAGE });
    case "image":
    case "file":
    case "video":
      return mediaRefSchema;
    default:
      return z.string();
  }
}

export function pruneNullValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(pruneNullValues);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== null)
        .map(([key, entry]) => [key, pruneNullValues(entry)]),
    );
  }

  return value;
}

export interface IngestField {
  name: string;
  required: boolean;
  type: FieldType;
}

const REQUIRED_NULL_MESSAGE = 'required field — "null" means absent here; provide a value';

export function buildIngestRecordSchema(fields: readonly IngestField[]): z.ZodType {
  const shape: Record<string, z.ZodType> = {};

  for (const field of fields) {
    const value = valueSchemaForFieldType(field.type);
    shape[field.name] = field.required ? value : value.optional();
  }

  return z
    .unknown()
    .superRefine((raw, ctx) => {
      for (const path of requiredNullPaths(fields, raw)) {
        ctx.addIssue({ code: "custom", path, message: REQUIRED_NULL_MESSAGE });
      }
    })
    .transform(pruneNullValues)
    .pipe(z.strictObject(shape));
}

function requiredNullPaths(fields: readonly IngestField[], record: unknown): (string | number)[][] {
  if (!isRecord(record)) return [];

  return fields.flatMap((field) => {
    const value = record[field.name];
    if (field.required && value === null) return [[field.name]];
    return nestedRequiredNullPaths(field.type, value, [field.name]);
  });
}

function nestedRequiredNullPaths(
  fieldType: FieldType,
  value: unknown,
  path: (string | number)[],
): (string | number)[][] {
  if (value === null || value === undefined) return [];
  switch (fieldType.type) {
    case "array":
      return Array.isArray(value) ?
          value.flatMap((entry, index) => nestedRequiredNullPaths(fieldType.element, entry, [...path, index]))
        : [];
    case "group": {
      if (!isRecord(value)) return [];
      return fieldType.fields.flatMap((sub) => {
        const entry = value[sub.name];
        const subPath = [...path, sub.name];
        if (sub.required && entry === null) return [subPath];
        return nestedRequiredNullPaths(sub.type, entry, subPath);
      });
    }
    default:
      return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function collectAssetIds(fieldType: FieldType, value: unknown): string[] {
  switch (fieldType.type) {
    case "image":
    case "file":
    case "video": {
      const parsed = mediaRefSchema.safeParse(value);
      return parsed.success ? [String(parsed.data.assetId)] : [];
    }
    case "array":
      return Array.isArray(value) ? value.flatMap((entry) => collectAssetIds(fieldType.element, entry)) : [];
    case "group": {
      if (value === null || typeof value !== "object") return [];
      const record = value as Record<string, unknown>;
      return fieldType.fields.flatMap((field) =>
        field.name in record ? collectAssetIds(field.type, record[field.name]) : [],
      );
    }
    default:
      return [];
  }
}
