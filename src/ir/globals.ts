import { z } from "zod";

import type { ArtifactDef } from "#ir/artifact.ts";
import { componentIdSchema, type ComponentId } from "#ir/common.ts";
import { fieldTypeSchema } from "#ir/field-type.ts";

export const GLOBALS_SCHEMA_VERSION = 3;

export const GLOBAL_NAMES = ["header", "footer"] as const;
export const globalNameSchema = z.enum(GLOBAL_NAMES);
export type GlobalName = z.infer<typeof globalNameSchema>;

export function globalComponentId(name: GlobalName): ComponentId {
  return componentIdSchema.parse(name);
}

export const globalFieldSchema = z.strictObject({
  name: z.string().min(1),
  label: z.string().min(1).optional(),
  type: fieldTypeSchema,
  required: z.boolean(),
});
export type GlobalField = z.infer<typeof globalFieldSchema>;

export const globalDefSchema = z.strictObject({
  name: z.string().min(1),
  fields: z.array(globalFieldSchema),
  values: z.record(z.string().min(1), z.json()),
});
export type GlobalDef = z.infer<typeof globalDefSchema>;

export const globalsDataSchema = z.strictObject({ globals: z.array(globalDefSchema) });
export type GlobalsData = z.infer<typeof globalsDataSchema>;

export const globalsArtifact: ArtifactDef<GlobalsData> = {
  kind: "globals",
  relativePath: "globals.json",
  schemaVersion: GLOBALS_SCHEMA_VERSION,
  dataSchema: globalsDataSchema,
};
