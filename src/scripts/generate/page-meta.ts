import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { loadHtml } from "#lib/html.ts";
import { pageMirrorPathForRoute, SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";

import { buildPageTree, type PageNode } from "./codegen/page-tree.ts";

export async function readPageMeta(opts: {
  projectPath: string;
  route: string;
}): Promise<{ title: string | null; description: string | null }> {
  const file = join(opts.projectPath, SNAPSHOT_DIR, pageMirrorPathForRoute(opts.route));
  if (!existsSync(file)) return { title: null, description: null };

  const $ = loadHtml(await readFile(file, "utf8"));
  const title = $("head title").first().text().trim();
  const description = $('head meta[name="description"]').attr("content")?.trim() ?? "";

  return { title: title === "" ? null : title, description: description === "" ? null : description };
}

export async function buildPageTreeArtifact(opts: {
  projectPath: string;
  routes: readonly string[];
}): Promise<PageNode[]> {
  const nodes = buildPageTree(opts.routes);

  for (const node of nodes) {
    if (node.route === null) continue;
    const meta = await readPageMeta({ projectPath: opts.projectPath, route: node.route });
    if (meta.title !== null) node.title = meta.title;
    node.metaTitle = meta.title;
    node.metaDescription = meta.description;
  }

  return nodes;
}
