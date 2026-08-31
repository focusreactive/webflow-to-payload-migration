import type { FieldType } from "#ir/field-type.ts";

import { createVerifyEditorConfig, htmlToLexicalForVerify } from "./lexical.ts";

export interface ResolveRichTextOpts {
  resolveImgSrc: (url: string) => string | undefined;
}

export async function resolveRichTextRecord(
  fields: { name: string; type: FieldType }[],
  record: Record<string, unknown>,
  opts: ResolveRichTextOpts,
): Promise<Record<string, unknown>> {
  const richTextNames = fields.filter((f) => f.type.type === "richText").map((f) => f.name);
  if (richTextNames.length === 0) return record;
  const editorConfig = await createVerifyEditorConfig();
  const out: Record<string, unknown> = { ...record };
  for (const name of richTextNames) {
    const value = record[name];
    if (typeof value === "string") out[name] = htmlToLexicalForVerify(value, editorConfig, opts.resolveImgSrc);
  }
  return out;
}
