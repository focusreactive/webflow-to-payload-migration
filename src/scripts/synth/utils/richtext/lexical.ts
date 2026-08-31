import { convertHTMLToLexical, editorConfigFactory, lexicalEditor } from "@payloadcms/richtext-lexical";
import { JSDOM } from "jsdom";

let cached: Promise<unknown> | undefined;

export function createVerifyEditorConfig(): Promise<unknown> {
  cached ??= editorConfigFactory.default({ config: { collections: [], editor: lexicalEditor() } as never });
  return cached;
}

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const SRC_ATTR_RE = /\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i;

function rewriteImgTags(html: string, resolveImgSrc: (url: string) => string | undefined): string {
  return html.replace(IMG_TAG_RE, (tag) => {
    const match = SRC_ATTR_RE.exec(tag);
    const url = match?.[2] ?? match?.[3];
    if (url === undefined) return tag;
    const resolved = resolveImgSrc(url) ?? url;
    return tag
      .replace(SRC_ATTR_RE, `src="${resolved}"`)
      .replace(/^<img\b/i, `<img data-lexical-upload-id="${resolved}" data-lexical-upload-relation-to="media"`);
  });
}

function stubUploadValues(node: unknown): void {
  if (node === null || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  if (record["type"] === "upload") {
    const id = typeof record["value"] === "string" ? record["value"] : record["id"];
    if (typeof id === "string") record["value"] = { id, url: id };
  }
  const children = record["children"];
  if (Array.isArray(children)) for (const child of children) stubUploadValues(child);
  const root = record["root"];
  if (root !== undefined) stubUploadValues(root);
}

export function htmlToLexicalForVerify(
  html: string,
  editorConfig: unknown,
  resolveImgSrc: (url: string) => string | undefined,
): unknown {
  const rewritten = rewriteImgTags(html, resolveImgSrc);
  const lexical = convertHTMLToLexical({ editorConfig: editorConfig as never, html: rewritten, JSDOM });
  stubUploadValues(lexical);
  return lexical;
}
