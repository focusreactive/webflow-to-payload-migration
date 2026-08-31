import { join } from "node:path";

import { z } from "zod";

import { type ArtifactDef } from "#ir/artifact.ts";
import { blockTypeIdSchema, collectionIdSchema, componentIdSchema } from "#ir/common.ts";

const rectSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const viewportRectSchema = z.strictObject({ rect: rectSchema });

export const boundarySchema = z.strictObject({
  nodeIds: z.array(z.string().min(1)).min(1),
  rects: z.record(z.string(), rectSchema),
});
export type Boundary = z.infer<typeof boundarySchema>;

export const blockInstanceSchema = z.strictObject({
  route: z.string().min(1),
  nodeIds: z.array(z.string().min(1)).min(1),
  role: z.string().min(1),
  summary: z.string(),
  boundaries: z.record(z.string(), viewportRectSchema),
});
export type BlockInstance = z.infer<typeof blockInstanceSchema>;

export const blockDiscTypeSchema = z.strictObject({
  id: blockTypeIdSchema,
  name: z.string().min(1),
  role: z.string().min(1),
  exemplar: z.strictObject({
    route: z.string().min(1),
    nodeIds: z.array(z.string().min(1)).min(1),
  }),
  collectionKey: collectionIdSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type BlockDiscType = z.infer<typeof blockDiscTypeSchema>;

export const discoveryBlocksDataSchema = z.strictObject({
  types: z.array(blockDiscTypeSchema),
});
export type DiscoveryBlocksData = z.infer<typeof discoveryBlocksDataSchema>;

export const DISCOVERY_BLOCKS_SCHEMA_VERSION = 3;
export const discoveryBlocksArtifact: ArtifactDef<DiscoveryBlocksData> = {
  kind: "discovery-blocks",
  relativePath: join("discovery", "blocks.json"),
  schemaVersion: DISCOVERY_BLOCKS_SCHEMA_VERSION,
  dataSchema: discoveryBlocksDataSchema,
};

export const blocksShardDataSchema = z.strictObject({
  route: z.string().min(1),
  instances: z.array(blockInstanceSchema),
});
export type BlocksShardData = z.infer<typeof blocksShardDataSchema>;

export function blocksShardArtifactFor(routeKey: string): ArtifactDef<BlocksShardData> {
  return {
    kind: "discovery-blocks-shard",
    relativePath: join("discovery", "blocks", `${routeKey}.json`),
    schemaVersion: DISCOVERY_BLOCKS_SCHEMA_VERSION,
    dataSchema: blocksShardDataSchema,
  };
}

export const globalDiscTypeSchema = z.strictObject({
  id: componentIdSchema,
  name: z.enum(["header", "footer"]),
  exemplar: z.strictObject({
    route: z.string().min(1),
    nodeIds: z.array(z.string().min(1)).min(1),
  }),
});
export const discoveryGlobalsDataSchema = z.strictObject({
  types: z.array(globalDiscTypeSchema),
});
export type DiscoveryGlobalsData = z.infer<typeof discoveryGlobalsDataSchema>;

export const DISCOVERY_GLOBALS_SCHEMA_VERSION = 3;
export const discoveryGlobalsArtifact: ArtifactDef<DiscoveryGlobalsData> = {
  kind: "discovery-globals",
  relativePath: join("discovery", "globals.json"),
  schemaVersion: DISCOVERY_GLOBALS_SCHEMA_VERSION,
  dataSchema: discoveryGlobalsDataSchema,
};

export const collectionSectionSchema = z.strictObject({
  id: z.string().min(1),
  role: z.string().min(1),
  summary: z.string(),
  nodeIds: z.array(z.string().min(1)).min(1),
  boundaries: z.record(z.string(), viewportRectSchema),
});
export type CollectionSection = z.infer<typeof collectionSectionSchema>;

export const discoveryCollectionTypeSchema = z.strictObject({
  collectionKey: collectionIdSchema,
  representativeItem: z.strictObject({ route: z.string().min(1), slug: z.string().optional() }),
  sections: z.array(collectionSectionSchema).default([]),
});
export const discoveryCollectionsDataSchema = z.strictObject({
  types: z.array(discoveryCollectionTypeSchema),
});
export type DiscoveryCollectionsData = z.infer<typeof discoveryCollectionsDataSchema>;

export const DISCOVERY_COLLECTIONS_SCHEMA_VERSION = 3;
export const discoveryCollectionsArtifact: ArtifactDef<DiscoveryCollectionsData> = {
  kind: "discovery-collections",
  relativePath: join("discovery", "collections.json"),
  schemaVersion: DISCOVERY_COLLECTIONS_SCHEMA_VERSION,
  dataSchema: discoveryCollectionsDataSchema,
};
