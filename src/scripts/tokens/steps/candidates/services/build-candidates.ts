import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { routeFromUrl } from "#lib/url.ts";
import { SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";

import type { TokenCandidatesData } from "../../../schemas/token-candidates.ts";
import { collectBreakpoints, collectFromStyles, type PageStyles } from "./collect.ts";
import { FONT_WEIGHT_TOLERANCE, NUMERIC_TOLERANCE, mergeNumeric, mergeShadows } from "./merge.ts";

const stylesSidecarSchema = z.record(z.string(), z.record(z.string(), z.string()));

const STYLE_BLOCK_PATTERN = /<style[^>]*>([\s\S]*?)<\/style>/gi;

export async function buildTokenCandidates(opts: {
  projectPath: string;
  store: SnapshotStore;
}): Promise<TokenCandidatesData> {
  const entries = opts.store.entries();

  const pages: PageStyles[] = [];
  const cssTexts: string[] = [];

  const pageEntries = entries
    .filter((entry) => entry.kind === "page" && entry.paths.styles !== undefined)
    .sort((a, b) => a.url.localeCompare(b.url));

  for (const entry of pageEntries) {
    const sidecarPath = join(opts.projectPath, SNAPSHOT_DIR, entry.paths.styles ?? "");
    const sidecar = stylesSidecarSchema.parse(JSON.parse(await readFile(sidecarPath, "utf8")));
    pages.push({ route: routeFromUrl(entry.url), elements: sidecar });

    if (entry.paths.rendered !== undefined) {
      const html = await readFile(join(opts.projectPath, SNAPSHOT_DIR, entry.paths.rendered), "utf8");
      const blocks = [...html.matchAll(STYLE_BLOCK_PATTERN)].map((match) => match[1] ?? "");
      if (blocks.length > 0) cssTexts.push(blocks.join("\n"));
    }
  }

  const styleEntries = entries.filter((entry) => entry.kind === "style").sort((a, b) => a.url.localeCompare(b.url));
  for (const entry of styleEntries) {
    cssTexts.push((await opts.store.readBody(entry)).toString("utf8"));
  }

  const collected = collectFromStyles(pages);
  const numeric = (values: Parameters<typeof mergeNumeric>[0], idPrefix: string) =>
    mergeNumeric(values, { tolerance: NUMERIC_TOLERANCE, idPrefix });

  return {
    colors: collected.colors.map((color, index) => ({ id: `color-${index + 1}`, ...color })),
    fontFamilies: collected.fontFamilies.map((family, index) => ({ id: `font-family-${index + 1}`, ...family })),
    fontSizes: numeric(collected.fontSizes, "font-size"),
    fontWeights: mergeNumeric(collected.fontWeights, {
      tolerance: FONT_WEIGHT_TOLERANCE,
      idPrefix: "font-weight",
    }),
    lineHeights: numeric(collected.lineHeights, "line-height"),
    letterSpacings: numeric(collected.letterSpacings, "letter-spacing"),
    spacings: numeric(collected.spacings, "spacing"),
    radii: numeric(collected.radii, "radius"),
    shadows: mergeShadows(collected.shadows),
    breakpoints: collectBreakpoints(cssTexts).map((breakpoint, index) => ({
      id: `breakpoint-${index + 1}`,
      ...breakpoint,
    })),
    gradients: collected.gradients,
  };
}
