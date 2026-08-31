import { z } from "zod";

import type { ArtifactDef } from "#ir/artifact.ts";

export const signalTierSchema = z.enum(["strong", "medium", "weak"]);

export const signalHitRecordSchema = z.strictObject({
  id: z.string(),
  tier: signalTierSchema,
  evidence: z.string(),
});

export const platformScoreSchema = z.strictObject({
  score: z.number(),
  hasTier1Strong: z.boolean(),
  signals: z.array(signalHitRecordSchema),
});

export const platformHintsSchema = z.strictObject({
  webflowSiteId: z.string().optional(),
  webflowPageId: z.string().optional(),
  webflowDomain: z.string().optional(),
});
export type PlatformHints = z.infer<typeof platformHintsSchema>;

export const detectDataSchema = z.strictObject({
  verdict: z.enum(["webflow", "unknown"]),
  scores: z.strictObject({ webflow: platformScoreSchema }),
  thresholds: z.strictObject({ confidence: z.number() }),
  platformHints: platformHintsSchema,
});
export type DetectData = z.infer<typeof detectDataSchema>;

export const detectArtifact: ArtifactDef<DetectData> = {
  kind: "detect",
  relativePath: "detect.json",
  schemaVersion: 1,
  dataSchema: detectDataSchema,
};
