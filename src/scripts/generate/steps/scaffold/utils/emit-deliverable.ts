import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { type BlocksData } from "#ir/blocks.ts";
import { type GlobalsData } from "#ir/globals.ts";
import { GLOBAL_NAMES } from "#ir/globals.ts";

import { RESERVED_COLLECTION_KEYS } from "../../../constants/collections.ts";
import { globalComponentDir } from "../../../constants/paths.ts";

const DIRECTIVE_PROLOGUE = /^\s*(["'])use (?:client|server)\1;?[ \t]*\r?\n?/;

function ensureJsxNamespaceImport(code: string): string {
  if (!/\bJSX\./.test(code)) return code;
  if (/import[^;]*\bJSX\b[^;]*from\s+["']react["']/.test(code)) return code;
  const jsxImport = `import type { JSX } from "react";\n`;
  const directive = DIRECTIVE_PROLOGUE.exec(code)?.[0];
  if (directive === undefined) return `${jsxImport}${code}`;
  return `${directive}${jsxImport}${code.slice(directive.length)}`;
}

export function rewriteRelativeTsImports(code: string): string {
  const rewritten = code.replace(/(from\s+["'])(\.{1,2}\/[^"']*)\.tsx?(["'])/g, "$1$2$3");
  return ensureJsxNamespaceImport(rewritten);
}

export async function stageRichTextDir(opts: {
  srcEntryDir: string;
  destDir: string;
  put: (relativePath: string, contents: string) => void;
  seen: Map<string, string>;
  warnings: string[];
  label: string;
}): Promise<void> {
  const dir = join(opts.srcEntryDir, "richtext");
  if (!existsSync(dir)) return;
  for (const file of (await readdir(dir)).sort()) {
    if (!file.endsWith(".tsx")) continue;
    const contents = rewriteRelativeTsImports(await readFile(join(dir, file), "utf8"));
    const relativePath = join(opts.destDir, "richtext", file);
    const previous = opts.seen.get(relativePath);
    if (previous !== undefined && previous !== contents) {
      opts.warnings.push(
        `richtext: ${opts.label} overwrites ${relativePath} with different per-tag styles — `
          + "two sections share the field name; the last one wins",
      );
    }
    opts.seen.set(relativePath, contents);
    opts.put(relativePath, contents);
  }
}

export async function readOptional<T>(reader: () => Promise<{ data: T }>): Promise<T | undefined> {
  try {
    return (await reader()).data;
  } catch {
    return undefined;
  }
}

export interface ChromeTokens {
  HEADER_IMPORT: string;
  FOOTER_IMPORT: string;
  HEADER_JSX: string;
  FOOTER_JSX: string;
}

export function chromeTokens(globals: GlobalsData): ChromeTokens {
  const present = new Set(globals.globals.map((def) => def.name));
  return {
    HEADER_IMPORT: present.has("header") ? 'import { Header } from "@/globals/Header";' : "",
    FOOTER_IMPORT: present.has("footer") ? 'import { Footer } from "@/globals/Footer";' : "",
    HEADER_JSX: present.has("header") ? "<Header />" : "",
    FOOTER_JSX: present.has("footer") ? "<Footer />" : "",
  };
}

export function assertNoGlobalDirCollision(blocks: BlocksData): void {
  const reserved = new Set(GLOBAL_NAMES.map((name) => globalComponentDir(name)));

  for (const block of blocks.blocks) {
    if (reserved.has(String(block.id))) {
      throw new Error(
        `BlockTypeId "${String(block.id)}" collides with the reserved chrome dir; `
          + `re-run blocks synthesis with a different role name (--force blocks)`,
      );
    }
  }
}

export function assertNoBuiltInCollectionKeyCollision(slugs: readonly string[]): void {
  for (const slug of slugs) {
    if (RESERVED_COLLECTION_KEYS.has(slug)) {
      throw new Error(
        `CMS collection slug "${slug}" collides with a reserved collection; `
          + `buildCollectionSlugMap's reserved-word seeding should have disambiguated this — treat it as a bug there`,
      );
    }
  }
}
