import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { DesignTokensData } from "#tokens/schemas/design-tokens.ts";

import { buildColorCandidates } from "./color-match.ts";
import { emitRichTextWrapper } from "./emit-wrapper.ts";
import { styleTableFromMeasured } from "./extract-styles.ts";
import { extrapolateTable } from "./extrapolate.ts";
import { richTextWrapperFile } from "./names.ts";
import { planRichText, richTextFieldNames } from "./plan.ts";
import type { RichTextField } from "./types.ts";

export { planRichText, richTextFieldNames };
export type { PlanRichTextOptions, RichTextPlanEntry } from "./plan.ts";
export type { RichTextField } from "./types.ts";

export interface EmitWrappersOpts {
  measured: Record<string, Record<string, Record<string, string>>>;
  fields: RichTextField[];
  tokens: DesignTokensData;
  outDir: string;
}

export async function emitRichTextWrappers(opts: EmitWrappersOpts): Promise<string[]> {
  const names = richTextFieldNames(opts.fields);
  if (names.length === 0) return [];
  const candidates = buildColorCandidates(opts.tokens);
  const written: string[] = [];
  for (const name of names) {
    const table = styleTableFromMeasured(opts.measured[name] ?? {}, candidates);
    const extrapolated = extrapolateTable(table);
    const file = join(opts.outDir, richTextWrapperFile(name));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, emitRichTextWrapper(name, extrapolated));
    written.push(name);
  }
  return written;
}
