import type { MediaNormalizer } from "#assets/types.ts";
import { sanitizeFileName } from "#lib/fs.ts";

export interface CanonicalAsset {
  canonicalUrl: string;
  platformId?: string;
  originalName?: string;
}

const WEBFLOW_CANONICAL_HOST = "cdn.prod.website-files.com";

const WEBFLOW_ASSET_HOST_ALIASES = new Set([
  "cdn.prod.website-files.com",
  "assets.website-files.com",
  "assets-global.website-files.com",
  "uploads-ssl.webflow.com",
]);

const WEBFLOW_VARIANT_WIDTHS = new Set([500, 800, 1080, 1600, 2000, 2600, 3200]);

const WEBFLOW_VARIANT_PATTERN = /-p-(\d+)\.[a-z0-9]+$/i;
const WEBFLOW_PLATFORM_ID_PATTERN = /^[0-9a-f]{24}$/;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function assetFileSegment(rawUrl: string): string {
  const { pathname } = new URL(rawUrl);
  const segment = pathname.split("/").pop() ?? "";
  return safeDecode(segment);
}

function assetNameParts(canonicalUrl: string): {
  platformId?: string;
  name: string;
} {
  const segment = assetFileSegment(canonicalUrl);
  const underscoreIndex = segment.indexOf("_");
  if (underscoreIndex < 0) return { name: segment };

  const prefix = segment.slice(0, underscoreIndex);
  const name = segment.slice(underscoreIndex + 1);
  return {
    ...(WEBFLOW_PLATFORM_ID_PATTERN.test(prefix) && { platformId: prefix }),
    name,
  };
}

export function canonicalizeWebflowAssetUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (WEBFLOW_ASSET_HOST_ALIASES.has(url.hostname)) {
    url.hostname = WEBFLOW_CANONICAL_HOST;
    url.search = "";
  }
  url.pathname = url.pathname.replace(/%2f/gi, "/");
  return url.toString();
}

export function isWebflowVariantUrl(url: string): boolean {
  const match = WEBFLOW_VARIANT_PATTERN.exec(assetFileSegment(url));
  const width = match?.[1];
  return width !== undefined && WEBFLOW_VARIANT_WIDTHS.has(Number(width));
}

export function webflowAssetFileName(canonicalUrl: string): string {
  return sanitizeFileName(assetNameParts(canonicalUrl).name);
}

export function webflowAssetPlatformId(canonicalUrl: string): string | undefined {
  return assetNameParts(canonicalUrl).platformId;
}

export const webflowMediaNormalizer: MediaNormalizer = {
  canonicalize(rawUrl) {
    const canonicalUrl = canonicalizeWebflowAssetUrl(rawUrl);
    const { platformId, name } = assetNameParts(canonicalUrl);
    return {
      canonicalUrl,
      ...(platformId !== undefined && { platformId }),
      ...(name !== "" && { originalName: name }),
    };
  },
  isVariant: isWebflowVariantUrl,
  fileName: webflowAssetFileName,
};
