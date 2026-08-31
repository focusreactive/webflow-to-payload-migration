import { z } from "zod";

import type { ArtifactDef } from "#ir/artifact.ts";

export const pageKindSchema = z.enum(["static", "item"]);
export const pageSourceSchema = z.enum(["sitemap", "crawl", "searchindex"]);
export type PageSource = z.infer<typeof pageSourceSchema>;

export const pageRecordSchema = z.strictObject({
  route: z.string(), // нормализованный путь; '/' для главной
  kind: pageKindSchema,
  collectionKey: z.string().optional(), // from data-wf-collection
  slug: z.string().optional(),
  localeId: z.string().optional(),
  sources: z.array(pageSourceSchema).min(1),
});
export const collectionRecordSchema = z.strictObject({
  key: z.string(),
  routePattern: z.string(), // '/works/:slug'
  itemCount: z.number().int().nonnegative(),
});
export const pagesDataSchema = z.strictObject({
  pages: z.array(pageRecordSchema),
  collections: z.array(collectionRecordSchema),
});
export type PagesData = z.infer<typeof pagesDataSchema>;

export const pagesArtifact: ArtifactDef<PagesData> = {
  kind: "pages",
  relativePath: "pages.json",
  schemaVersion: 1,
  dataSchema: pagesDataSchema,
};
