import { join, posix } from "node:path";

import { sanitizeFileName, writeFileAtomic } from "#lib/fs.ts";
import type { Logger } from "#lib/logger.ts";
import { FONT_ASSETS_DIR, FONTS_CSS_RELATIVE_PATH } from "#lib/snapshot-store/fonts.ts";
import { SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";

import type { CollectedFontFace } from "./types.ts";
import {
  binaryFileName,
  dedupeFaces,
  facesFromCss,
  fontFaceRule,
  providerStylesheetUrls,
} from "./utils/run-font-pass.ts";

export async function runFontPass(opts: {
  projectPath: string;
  store: SnapshotStore;
  pages: { url: string; html: string }[];
  fetchCss: (url: string) => Promise<string>;
  logger: Logger;
}): Promise<{ faces: number; downloaded: number }> {
  const collected: CollectedFontFace[] = [];

  for (const page of opts.pages) {
    collected.push(...facesFromCss(page.html, page.url));
  }
  for (const entry of opts.store.entries()) {
    if (entry.kind !== "style") continue;
    const css = (await opts.store.readBody(entry)).toString("utf8");
    collected.push(...facesFromCss(css, entry.url));
  }

  const providerUrls = [...new Set(opts.pages.flatMap((page) => providerStylesheetUrls(page.html, page.url)))];
  for (const url of providerUrls) {
    try {
      collected.push(...facesFromCss(await opts.fetchCss(url), url));
    } catch (error) {
      opts.logger.warn("snapshot: failed to fetch font provider css, skipping", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const faces = dedupeFaces(collected);
  const rules: string[] = [];
  const usedNames = new Set<string>();
  let downloaded = 0;

  for (const face of faces) {
    const fileName = sanitizeFileName(binaryFileName(face.binaryUrl), { existing: usedNames });
    try {
      const entry = await opts.store.fetchInto(face.binaryUrl, "asset", {
        relativePath: posix.join(FONT_ASSETS_DIR, fileName),
      });
      usedNames.add(posix.basename(entry.paths.raw));
      rules.push(fontFaceRule(face, posix.relative("styles", entry.paths.raw)));
      downloaded += 1;
    } catch (error) {
      opts.logger.warn("snapshot: failed to download font binary, skipping", {
        url: face.binaryUrl,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const css = rules.length > 0 ? `${rules.join("\n\n")}\n` : "";
  await writeFileAtomic(join(opts.projectPath, SNAPSHOT_DIR, FONTS_CSS_RELATIVE_PATH), css);
  return { faces: faces.length, downloaded };
}
