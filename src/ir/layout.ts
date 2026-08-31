import { join } from "node:path";

import { z } from "zod";

import type { ArtifactDef } from "#ir/artifact.ts";
import { blockTypeIdSchema, provenanceSchema } from "#ir/common.ts";
import { anyValueSourceSchema } from "#ir/value-source.ts";

export const LAYOUT_SCHEMA_VERSION = 1;

export const layoutRecordSchema = z.strictObject({
  order: z.number().int().min(0),
  blockType: blockTypeIdSchema,
  anchorMigId: z.string().min(1),
  fields: z.record(z.string().min(1), anyValueSourceSchema),
  _provenance: provenanceSchema,
  _confidence: z.number().min(0).max(1).optional(),
});
export type LayoutRecord = z.infer<typeof layoutRecordSchema>;

export const layoutUnitMetaSchema = z.discriminatedUnion("unitKind", [
  z.strictObject({ unitKind: z.literal("static"), route: z.string().min(1) }),
  z.strictObject({
    unitKind: z.literal("template"),
    collectionKey: z.string().min(1),
    routePattern: z.string().min(1),
    representativeRoute: z.string().min(1),
  }),
]);
export type LayoutUnitMeta = z.infer<typeof layoutUnitMetaSchema>;

export function layoutRouteArtifactFor(routeKey: string): ArtifactDef<LayoutRecord> {
  return {
    kind: "layout",
    relativePath: join("layout", "routes", `${routeKey}.ndjson`),
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    dataSchema: layoutRecordSchema,
  };
}
