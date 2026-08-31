import { z } from "zod";

import { artifactEnvelope } from "#ir/artifact.ts";

export const STITCH_INDEX_SCHEMA_VERSION = 1;

const rectSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const dimSchema = z.strictObject({
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});

const stickyRegionSchema = z.strictObject({
  migId: z.string().min(1),
  rect: rectSchema,
});

export const stitchViewportSchema = z.strictObject({
  file: z.string().min(1),
  doc: dimSchema,
  dpr: z.number().positive(),
  pixels: dimSchema,
  stickyRegions: z.array(stickyRegionSchema),
});
export type StitchViewport = z.infer<typeof stitchViewportSchema>;

export const stitchIndexDataSchema = z.strictObject({
  route: z.string().min(1),
  url: z.string(),
  capturedAt: z.iso.datetime(),
  stitches: z.record(z.string(), stitchViewportSchema),
  elements: z.record(z.string(), z.record(z.string(), z.strictObject({ rect: rectSchema }))),
});
export type StitchIndexData = z.infer<typeof stitchIndexDataSchema>;

export const stitchIndexSchema = artifactEnvelope(stitchIndexDataSchema, STITCH_INDEX_SCHEMA_VERSION);
