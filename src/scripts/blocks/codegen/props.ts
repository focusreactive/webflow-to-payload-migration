import { blockPropsInterfaceName } from "#blocks/codegen/names.ts";
import { type BlockType } from "#ir/blocks.ts";
import { type FieldType } from "#ir/field-type.ts";

const RESOLVED_DOC_TYPE = "{ id: string } & Record<string, unknown>";

export function propKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

export function emitBlockProps(block: BlockType): string {
  const iface = blockPropsInterfaceName(block.id);
  const lines = block.fields.map((f) => `  ${propKey(f.name)}${f.required ? "" : "?"}: ${tsType(f.type)};`);
  if (block.collectionKey !== undefined) {
    lines.push(`  docs?: (${RESOLVED_DOC_TYPE})[];`);
  }
  const media = usesMediaProp(block) ? "export interface MediaProp {\n  src: string;\n  alt?: string;\n}\n\n" : "";
  const richText =
    usesRichText(block) ?
      'import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";\n\ntype RichTextData = SerializedEditorState;\n\n'
    : "";

  return `${richText}${media}export interface ${iface} {\n${lines.join("\n")}\n}\n`;
}

function usesRichText(block: BlockType): boolean {
  const walk = (type: FieldType): boolean => {
    switch (type.type) {
      case "richText":
        return true;
      case "array":
        return walk(type.element);
      case "group":
        return type.fields.some((f) => walk(f.type));
      default:
        return false;
    }
  };
  return block.fields.some((f) => walk(f.type));
}

export function usesMediaProp(block: BlockType): boolean {
  return block.fields.some((f) => fieldUsesMedia(f.type));
}

function fieldUsesMedia(type: FieldType): boolean {
  switch (type.type) {
    case "image":
    case "file":
    case "video":
      return true;
    case "array":
      return fieldUsesMedia(type.element);
    case "group":
      return type.fields.some((f) => fieldUsesMedia(f.type));
    default:
      return false;
  }
}

function tsType(type: FieldType): string {
  switch (type.type) {
    case "richText":
      return "RichTextData";
    case "text":
    case "color":
    case "url":
    case "email":
    case "phone":
    case "date":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "image":
    case "file":
    case "video":
      return "MediaProp";
    case "option":
      return type.values.map((v) => JSON.stringify(v)).join(" | ");
    case "reference":
      return RESOLVED_DOC_TYPE;
    case "multiReference":
      return `(${RESOLVED_DOC_TYPE})[]`;
    case "array":
      return `${tsType(type.element)}[]`;
    case "group":
      return `{ ${type.fields.map((f) => `${propKey(f.name)}${f.required ? "" : "?"}: ${tsType(f.type)}`).join("; ")} }`;
    case "unsupported":
      return "unknown";
  }
}
