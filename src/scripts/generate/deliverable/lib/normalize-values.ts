export interface FieldTypeNode {
  type: string;
  element?: FieldTypeNode;
  fields?: FieldDef[];
  values?: string[];
  collectionKey?: string;
}

export interface FieldDef {
  name: string;
  type: FieldTypeNode;
  required: boolean;
}

export interface MediaProp {
  src: string;
  alt?: string;
}

export type NormalizedDoc = { id: string } & Record<string, unknown>;

export type NormalizeCtx = Record<never, never>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mediaPropFrom(value: unknown): MediaProp | undefined {
  if (!isRecord(value) || typeof value["url"] !== "string") return undefined;
  const alt = value["alt"];
  return { src: value["url"], ...(typeof alt === "string" && alt !== "" ? { alt } : {}) };
}

function slugFrom(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (isRecord(value)) {
    if (typeof value["slug"] === "string" && value["slug"] !== "") return value["slug"];
    if (typeof value["id"] === "string" || typeof value["id"] === "number") return String(value["id"]);
  }
  return undefined;
}

export function normalizeValue(node: FieldTypeNode, value: unknown, ctx: NormalizeCtx): unknown {
  if (value === null || value === undefined) return undefined;
  switch (node.type) {
    case "image":
    case "file":
    case "video":
      return mediaPropFrom(value);
    case "richText":
      return value;
    case "reference":
      return slugFrom(value);
    case "multiReference":
      return Array.isArray(value) ? value.map(slugFrom).filter((v) => v !== undefined) : undefined;
    case "array": {
      if (!Array.isArray(value) || node.element === undefined) return undefined;
      const element = node.element;
      return value
        .map((row) => (isRecord(row) ? normalizeValue(element, row["item"], ctx) : undefined))
        .filter((v) => v !== undefined);
    }
    case "group": {
      if (!isRecord(value) || node.fields === undefined) return undefined;
      return normalizeRecord(node.fields, value, ctx);
    }
    default:
      return value;
  }
}

export function normalizeRecord(
  fields: FieldDef[],
  data: Record<string, unknown>,
  ctx: NormalizeCtx,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const normalized = normalizeValue(field.type, data[field.name], ctx);
    if (normalized !== undefined) out[field.name] = normalized;
  }
  return out;
}

export function normalizeDoc(fields: FieldDef[], doc: Record<string, unknown>, ctx: NormalizeCtx): NormalizedDoc {
  return { ...normalizeRecord(fields, doc, ctx), id: String(doc["id"]) };
}

export function normalizeProps<TProps>(fields: FieldDef[], record: Record<string, unknown>, ctx: NormalizeCtx): TProps {
  // Field defs and TProps are generated from the same IR entry, so they agree by
  // construction; this is the single seam where the dynamic shape becomes typed.
  return normalizeRecord(fields, record, ctx) as TProps;
}
