import { z } from "zod";

export type Brand<T, B extends string> = T & z.core.$brand<B>;

export const pageIdSchema = z.string().min(1).brand<"PageId">();
export const collectionIdSchema = z.string().min(1).brand<"CollectionId">();
export const assetIdSchema = z.string().min(1).brand<"AssetId">();
export const blockTypeIdSchema = z.string().min(1).brand<"BlockTypeId">();
export const componentIdSchema = z.string().min(1).brand<"ComponentId">();

export type PageId = z.infer<typeof pageIdSchema>;
export type CollectionId = z.infer<typeof collectionIdSchema>;
export type AssetId = z.infer<typeof assetIdSchema>;
export type BlockTypeId = z.infer<typeof blockTypeIdSchema>;
export type ComponentId = z.infer<typeof componentIdSchema>;

export const provenanceSchema = z.enum(["published", "api", "ai"]);
export type Provenance = z.infer<typeof provenanceSchema>;

export const mediaRefSchema = z.strictObject({
  assetId: assetIdSchema,
  alt: z.string().optional(),
});
export type MediaRef = z.infer<typeof mediaRefSchema>;
