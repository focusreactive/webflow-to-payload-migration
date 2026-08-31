import type { CheerioAPI } from "cheerio";

import { loadHtml } from "#lib/html.ts";

const MIG_ID_ATTRIBUTE = "data-mig-id";

type Selection = ReturnType<CheerioAPI>;

export function anchorPaths(html: string): Record<string, number[]> {
  const $ = loadHtml(html);
  const paths: Record<string, number[]> = {};

  function visit(parent: Selection, prefix: readonly number[]): void {
    parent.children().each((index, element) => {
      const node = $(element);
      const path = [...prefix, index];
      const migId = node.attr(MIG_ID_ATTRIBUTE);
      if (migId !== undefined) paths[migId] = path;
      visit(node, path);
    });
  }

  visit($("body"), []);

  return paths;
}
