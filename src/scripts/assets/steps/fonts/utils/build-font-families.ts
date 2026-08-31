import type { FontClassification } from "#ir/assets.ts";

import { WEIGHT_NAME_TO_VALUE } from "../../../constants/fonts.ts";

export function classifyFontSource(srcUrl: string | undefined): FontClassification {
  if (srcUrl === undefined) return "custom";
  if (srcUrl.includes("fonts.gstatic.com") || srcUrl.includes("fonts.googleapis.com")) {
    return "google";
  }
  if (srcUrl.includes("fontshare")) return "fontshare";
  if (srcUrl.includes("use.typekit.net") || srcUrl.includes("typekit")) {
    return "adobe";
  }
  return "custom";
}

export function fontDownloadPolicy(classification: FontClassification): {
  downloaded: boolean;
  licenseRisk: boolean;
} {
  switch (classification) {
    case "google":
      return { downloaded: false, licenseRisk: false };
    case "fontshare":
      return { downloaded: true, licenseRisk: false };
    case "custom":
      return { downloaded: true, licenseRisk: true };
    case "adobe":
      return { downloaded: false, licenseRisk: true };
  }
}

export function normalizeFamilyName(rawFamily: string): {
  family: string;
  weight?: string;
  style?: "normal" | "italic";
} {
  const tokens = rawFamily.trim().split(/\s+/);
  let style: "normal" | "italic" | undefined;
  let weight: string | undefined;

  if (tokens.length > 1 && tokens[tokens.length - 1]?.toLowerCase() === "italic") {
    style = "italic";
    tokens.pop();
  }
  const lastToken = tokens[tokens.length - 1]?.toLowerCase();
  if (tokens.length > 1 && lastToken !== undefined && lastToken in WEIGHT_NAME_TO_VALUE) {
    weight = WEIGHT_NAME_TO_VALUE[lastToken];
    tokens.pop();
  }

  return {
    family: tokens.join(" "),
    ...(weight !== undefined && { weight }),
    ...(style !== undefined && { style }),
  };
}

export function sortWeights(weights: Iterable<string>): string[] {
  return [...new Set(weights)].sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    return a.localeCompare(b);
  });
}
