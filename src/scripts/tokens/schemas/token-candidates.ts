import { z } from "zod";

import type { ArtifactDef } from "#ir/artifact.ts";

export const TOKEN_CANDIDATES_SCHEMA_VERSION = 2;

const usageSchema = z.number().int().positive();
const idSchema = z.string().min(1);

export const colorCandidateSchema = z.strictObject({
  id: idSchema,
  value: z.string().min(1),
  oklch: z.strictObject({ l: z.number(), c: z.number(), h: z.number(), alpha: z.number() }),
  usageCount: usageSchema,
});
export type ColorCandidate = z.infer<typeof colorCandidateSchema>;

export const numericCandidateSchema = z.strictObject({
  id: idSchema,
  value: z.number(),
  usageCount: usageSchema,
});
export type NumericCandidate = z.infer<typeof numericCandidateSchema>;

export const shadowLayerSchema = z.strictObject({
  color: z.string().min(1),
  offsetX: z.number(),
  offsetY: z.number(),
  blur: z.number(),
  spread: z.number(),
  inset: z.boolean(),
});
export type ShadowLayer = z.infer<typeof shadowLayerSchema>;

export const shadowCandidateSchema = z.strictObject({
  id: idSchema,
  value: z.string().min(1),
  layers: z.array(shadowLayerSchema).min(1),
  usageCount: usageSchema,
});
export type ShadowCandidate = z.infer<typeof shadowCandidateSchema>;

export const fontFamilyCandidateSchema = z.strictObject({
  id: idSchema,
  stack: z.array(z.string().min(1)).min(1),
  usageCount: usageSchema,
});
export type FontFamilyCandidate = z.infer<typeof fontFamilyCandidateSchema>;

export const breakpointCandidateSchema = z.strictObject({
  id: idSchema,
  valuePx: z.number().positive(),
  usageCount: usageSchema,
});
export type BreakpointCandidate = z.infer<typeof breakpointCandidateSchema>;

export const gradientCandidateSchema = z.strictObject({
  value: z.string().min(1),
  usageCount: usageSchema,
});
export type GradientCandidate = z.infer<typeof gradientCandidateSchema>;

export const tokenCandidatesDataSchema = z.strictObject({
  colors: z.array(colorCandidateSchema),
  fontFamilies: z.array(fontFamilyCandidateSchema),
  fontSizes: z.array(numericCandidateSchema),
  fontWeights: z.array(numericCandidateSchema),
  lineHeights: z.array(numericCandidateSchema),
  letterSpacings: z.array(numericCandidateSchema),
  spacings: z.array(numericCandidateSchema),
  radii: z.array(numericCandidateSchema),
  shadows: z.array(shadowCandidateSchema),
  breakpoints: z.array(breakpointCandidateSchema),
  gradients: z.array(gradientCandidateSchema),
});
export type TokenCandidatesData = z.infer<typeof tokenCandidatesDataSchema>;

export const tokenCandidatesArtifact: ArtifactDef<TokenCandidatesData> = {
  kind: "token-candidates",
  relativePath: "token-candidates.json",
  schemaVersion: TOKEN_CANDIDATES_SCHEMA_VERSION,
  dataSchema: tokenCandidatesDataSchema,
};
