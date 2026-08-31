import { z } from "zod";

import { SEMANTIC_COLOR_VALUE_PATTERN } from "#lib/semantic-color.ts";

import { tokenNameSchema } from "./design-tokens.ts";

const namedCandidateSchema = z.strictObject({
  candidateId: z.string().min(1),
  name: tokenNameSchema,
});

const roleSchema = z.strictObject({
  name: tokenNameSchema,
  value: z.string().regex(SEMANTIC_COLOR_VALUE_PATTERN),
  candidateId: z.string(),
});

export const tokensResponseSchema = z.strictObject({
  colors: z.strictObject({
    primitives: z.array(namedCandidateSchema),
    roles: z.array(roleSchema),
  }),
  fontFamilies: z.array(namedCandidateSchema),
  fontSizes: z.array(namedCandidateSchema),
  fontWeights: z.array(namedCandidateSchema),
  lineHeights: z.array(namedCandidateSchema),
  letterSpacings: z.array(namedCandidateSchema),
  spacings: z.array(namedCandidateSchema),
  radii: z.array(namedCandidateSchema),
  shadows: z.array(namedCandidateSchema),
  breakpoints: z.array(namedCandidateSchema),
});

export type TokensResponse = z.infer<typeof tokensResponseSchema>;
