import { blockTypeIdSchema, type BlockTypeId } from "#ir/common.ts";

export function mintBlockTypeId(role: string, existingIds: readonly BlockTypeId[]): BlockTypeId {
  const base = slugify(role) || "block";
  const taken = new Set<string>(existingIds as readonly string[]);
  if (!taken.has(base)) return blockTypeIdSchema.parse(base);

  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return blockTypeIdSchema.parse(candidate);
  }
}

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
