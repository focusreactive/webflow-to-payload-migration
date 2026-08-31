import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const templatesDir = dirname(fileURLToPath(import.meta.url));

// A dropped token would otherwise reach the deliverable as the raw slot text, where it parses as
// a bare identifier and survives until the deliverable's own typecheck. Every `__NAME__`-shaped
// string in every template is a slot this module substitutes (verified by grep), so the generic
// shape is safe to reject wholesale.
const UNSUBSTITUTED_SLOT = /__[A-Z][A-Z0-9_]*__/;

export async function readTemplate(relativePath: string, tokens?: Record<string, string>): Promise<string> {
  let content = await readFile(join(templatesDir, relativePath), "utf8");
  for (const [token, value] of Object.entries(tokens ?? {})) {
    content = content.replaceAll(`__${token}__`, value);
  }

  const leftover = UNSUBSTITUTED_SLOT.exec(content);
  if (leftover !== null) {
    throw new Error(`${relativePath}: slot ${leftover[0]} was not substituted — the call site must pass it`);
  }
  return content;
}
