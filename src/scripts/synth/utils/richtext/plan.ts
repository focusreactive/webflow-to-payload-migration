import { normalizeTag } from "./tag-set.ts";
import type { RichTextField, RichTextTag } from "./types.ts";

export function richTextFieldNames(fields: RichTextField[]): string[] {
  return fields.filter((field) => field.type.type === "richText").map((field) => field.name);
}

export interface RichTextPlanEntry {
  field: string;
  tags: string[];
}

export interface PlanRichTextOptions {
  fields: RichTextField[];
  literals: Record<string, unknown>;
}

export function planRichText(opts: PlanRichTextOptions): RichTextPlanEntry[] {
  return richTextFieldNames(opts.fields).map((field) => ({
    field,
    tags: tagsUsedIn(opts.literals[field]),
  }));
}

const IS_BOLD = 1;
const IS_ITALIC = 1 << 1;
const IS_STRIKETHROUGH = 1 << 2;
const IS_UNDERLINE = 1 << 3;
const IS_CODE = 1 << 4;

const TEXT_FORMAT_TAGS: readonly { bit: number; tag: RichTextTag }[] = [
  { bit: IS_BOLD, tag: "strong" },
  { bit: IS_ITALIC, tag: "em" },
  { bit: IS_STRIKETHROUGH, tag: "s" },
  { bit: IS_UNDERLINE, tag: "u" },
  { bit: IS_CODE, tag: "code" },
];

function tagsFromTextFormat(format: unknown): RichTextTag[] {
  const bits = typeof format === "number" ? format : 0;
  return TEXT_FORMAT_TAGS.filter((entry) => (bits & entry.bit) !== 0).map((entry) => entry.tag);
}

function tagsOfNode(record: Record<string, unknown>): RichTextTag[] {
  const type = record["type"];
  if (typeof type !== "string") return [];
  switch (type) {
    case "text":
      return tagsFromTextFormat(record["format"]);
    case "heading":
    case "list": {
      const explicit = record["tag"];
      return typeof explicit === "string" ? [normalizeTag(explicit)] : [];
    }
    case "paragraph":
      return ["p"];
    case "listitem":
      return ["li"];
    case "quote":
      return ["blockquote"];
    case "link":
    case "autolink":
      return ["a"];
    case "code":
      return ["code"];
    case "horizontalrule":
      return ["hr"];
    case "upload":
      return ["img"];
    default:
      return [];
  }
}

function collectTags(node: unknown, tags: Set<RichTextTag>): void {
  if (node === null || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  for (const tag of tagsOfNode(record)) tags.add(tag);
  const children = record["children"];
  if (Array.isArray(children)) for (const child of children) collectTags(child, tags);
}

function tagsUsedIn(literal: unknown): string[] {
  if (literal === null || typeof literal !== "object") return [];
  const root = (literal as Record<string, unknown>)["root"];
  const tags = new Set<RichTextTag>();
  collectTags(root, tags);
  return [...tags].sort();
}
