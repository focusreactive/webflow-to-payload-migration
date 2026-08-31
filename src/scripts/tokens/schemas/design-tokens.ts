import { z } from "zod";

import type { ArtifactDef } from "#ir/artifact.ts";
import { SEMANTIC_COLOR_VALUE_PATTERN } from "#lib/semantic-color.ts";

export const DESIGN_TOKENS_SCHEMA_VERSION = 2;

export const tokenNameSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const dtcgColorValueSchema = z.strictObject({
  colorSpace: z.literal("oklch"),
  components: z.tuple([z.number(), z.number(), z.number()]),
  alpha: z.number().min(0).max(1),
  hex: z.string().regex(/^#[0-9a-f]{6}$/),
});
export type DtcgColorValue = z.infer<typeof dtcgColorValueSchema>;

const dimensionValueSchema = z.strictObject({ value: z.number(), unit: z.literal("px") });

const colorTokenSchema = z.strictObject({
  $type: z.literal("color"),
  $value: dtcgColorValueSchema,
});
const dimensionTokenSchema = z.strictObject({
  $type: z.literal("dimension"),
  $value: dimensionValueSchema,
});
const fontFamilyTokenSchema = z.strictObject({
  $type: z.literal("fontFamily"),
  $value: z.array(z.string().min(1)).min(1),
});
const fontWeightTokenSchema = z.strictObject({
  $type: z.literal("fontWeight"),
  $value: z.number(),
});
const shadowLayerValueSchema = z.strictObject({
  color: dtcgColorValueSchema,
  offsetX: dimensionValueSchema,
  offsetY: dimensionValueSchema,
  blur: dimensionValueSchema,
  spread: dimensionValueSchema,
  inset: z.boolean(),
});
const shadowTokenSchema = z.strictObject({
  $type: z.literal("shadow"),
  $value: z.array(shadowLayerValueSchema).min(1),
});

const semanticColorTokenSchema = z.strictObject({
  $type: z.literal("color"),
  $value: z.string().regex(SEMANTIC_COLOR_VALUE_PATTERN),
});

export const designTokensDataSchema = z.strictObject({
  primitive: z.strictObject({
    color: z.record(tokenNameSchema, colorTokenSchema),
    fontFamily: z.record(tokenNameSchema, fontFamilyTokenSchema),
    fontSize: z.record(tokenNameSchema, dimensionTokenSchema),
    fontWeight: z.record(tokenNameSchema, fontWeightTokenSchema),
    lineHeight: z.record(tokenNameSchema, dimensionTokenSchema),
    letterSpacing: z.record(tokenNameSchema, dimensionTokenSchema),
    spacing: z.record(tokenNameSchema, dimensionTokenSchema),
    radius: z.record(tokenNameSchema, dimensionTokenSchema),
    shadow: z.record(tokenNameSchema, shadowTokenSchema),
    breakpoint: z.record(tokenNameSchema, dimensionTokenSchema),
  }),
  semantic: z.strictObject({
    color: z.record(tokenNameSchema, semanticColorTokenSchema),
  }),
});
export type DesignTokensData = z.infer<typeof designTokensDataSchema>;

export const designTokensArtifact: ArtifactDef<DesignTokensData> = {
  kind: "design-tokens",
  relativePath: "design-tokens.json",
  schemaVersion: DESIGN_TOKENS_SCHEMA_VERSION,
  dataSchema: designTokensDataSchema,
};
