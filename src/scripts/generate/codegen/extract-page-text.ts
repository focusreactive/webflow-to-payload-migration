import { propKey } from "#blocks/codegen/props.ts";
import { type BlocksData } from "#ir/blocks.ts";

const TEXT_FIELD_TYPES = new Set(["text", "richText"]);

export function emitExtractPageTextFile(blocks: BlocksData): string {
  const entries = blocks.blocks
    .map((block) => {
      const slugs = block.fields
        .filter((field) => TEXT_FIELD_TYPES.has(field.type.type))
        .map((field) => JSON.stringify(field.name));
      return `  ${propKey(String(block.id))}: [${slugs.join(", ")}],`;
    })
    .join("\n");

  return `const TEXT_FIELDS_BY_BLOCK: Record<string, string[]> = {
${entries}
};

function textOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(textOf);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(textOf);
  return [];
}

export function extractPageText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  const parts: string[] = [];
  for (const block of blocks) {
    if (block === null || typeof block !== "object") continue;
    const record = block as Record<string, unknown>;
    const blockType = record["blockType"];
    if (typeof blockType !== "string") continue;
    for (const slug of TEXT_FIELDS_BY_BLOCK[blockType] ?? []) {
      parts.push(...textOf(record[slug]));
    }
  }
  return parts.join(" ").replace(/\\s+/gu, " ").trim();
}
`;
}
