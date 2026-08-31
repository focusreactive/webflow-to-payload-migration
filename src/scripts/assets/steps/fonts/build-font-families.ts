import type { FontClassification, FontFace } from "#ir/assets.ts";

import { DEFAULT_WEIGHT } from "../../constants/fonts.ts";
import type { FontFaceSrc, FontFamilyRecord } from "../../types.ts";

import {
  classifyFontSource,
  fontDownloadPolicy,
  normalizeFamilyName,
  sortWeights,
} from "./utils/build-font-families.ts";

interface FamilyAccumulator {
  family: string;
  weights: Set<string>;
  style?: "normal" | "italic";
  unicodeRange?: string;
  classification: FontClassification;
  srcUrl?: string;
}

export function buildFontFamilies(opts: { faces: FontFaceSrc[]; googleFamilies: string[] }): FontFamilyRecord[] {
  const byFamily = new Map<string, FamilyAccumulator>();

  for (const face of opts.faces) {
    const normalized = normalizeFamilyName(face.family);
    const acc = byFamily.get(normalized.family) ?? {
      family: normalized.family,
      weights: new Set<string>(),
      classification: classifyFontSource(face.srcUrl),
      ...(face.srcUrl !== undefined && { srcUrl: face.srcUrl }),
    };
    acc.weights.add(face.weight ?? normalized.weight ?? DEFAULT_WEIGHT);
    const style = face.style ?? normalized.style;
    if (acc.style === undefined && style !== undefined) acc.style = style;
    if (acc.unicodeRange === undefined && face.unicodeRange !== undefined) {
      acc.unicodeRange = face.unicodeRange;
    }
    byFamily.set(normalized.family, acc);
  }

  for (const entry of opts.googleFamilies) {
    const [rawFamily, weightSpec] = entry.split(":");
    const family = (rawFamily ?? "").trim();
    if (family === "") continue;
    const acc = byFamily.get(family) ?? {
      family,
      weights: new Set<string>(),
      classification: "google" as const,
    };
    for (const token of (weightSpec ?? "").split(",").map((w) => w.trim())) {
      if (token !== "") acc.weights.add(token);
    }
    byFamily.set(family, acc);
  }

  return [...byFamily.values()]
    .sort((a, b) => a.family.localeCompare(b.family))
    .map((acc) => {
      const policy = fontDownloadPolicy(acc.classification);
      const { style, unicodeRange, srcUrl } = acc;
      const face: FontFace = {
        family: acc.family,
        weights: sortWeights(acc.weights),
        ...(style !== undefined && { style }),
        ...(unicodeRange !== undefined && { unicodeRange }),
        classification: acc.classification,
        downloaded: policy.downloaded,
        licenseRisk: policy.licenseRisk,
      };
      return {
        family: acc.family,
        face,
        ...(policy.downloaded && srcUrl !== undefined && { srcUrl }),
      };
    });
}
