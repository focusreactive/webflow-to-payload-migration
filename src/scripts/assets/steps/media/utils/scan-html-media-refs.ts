import { z } from "zod";

export const lightboxJsonSchema = z.looseObject({
  items: z.array(z.looseObject({ url: z.string().optional() })).optional(),
});

export function srcsetCandidates(srcset: string): string[] {
  return srcset
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/, 1)[0] ?? "")
    .filter((url) => url !== "");
}
