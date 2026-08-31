import { z } from "zod";

export const snapshotEntrySchema = z.strictObject({
  url: z.string(),
  kind: z.enum(["page", "style", "script", "data", "asset", "probe"]),
  paths: z.strictObject({
    raw: z.string(),
    rendered: z.string().optional(),
    styles: z.string().optional(),
  }),
  http: z.strictObject({
    status: z.number().int(),
    finalUrl: z.string(),
    redirectChain: z.array(z.string()),
    contentType: z.string().optional(),
    etag: z.string().optional(),
    lastModified: z.string().optional(),
  }),
  sha256: z.string(),
  size: z.number().int().nonnegative(),
  fetchedAt: z.iso.datetime(),
});
export type SnapshotEntry = z.infer<typeof snapshotEntrySchema>;

export const SNAPSHOT_INDEX_SCHEMA_VERSION = 2;

export const snapshotIndexSchema = z.strictObject({
  schemaVersion: z.literal(SNAPSHOT_INDEX_SCHEMA_VERSION),
  entries: z.record(z.string(), snapshotEntrySchema),
});
export type SnapshotIndex = z.infer<typeof snapshotIndexSchema>;
