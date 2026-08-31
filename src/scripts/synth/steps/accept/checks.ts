import { transform } from "esbuild";

import type { SurfaceCheck } from "#lib/surface-record/index.ts";

const HARNESS_TIMEOUT_MS = 30_000;

export async function checkSyntax(source: string): Promise<SurfaceCheck> {
  try {
    await transform(source, { loader: "tsx" });
    return { name: "syntax", ok: true, detail: "Component.tsx parses as tsx" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { name: "syntax", ok: false, detail: message };
  }
}

export function checkInputCovered(fieldNames: readonly string[], input: Record<string, unknown>): SurfaceCheck {
  const missing = fieldNames.filter((name) => !(name in input));
  return {
    name: "input-covered",
    ok: missing.length === 0,
    detail:
      missing.length === 0 ?
        `all ${String(fieldNames.length)} declared fields carry a value`
      : `input.json has no value for: ${missing.join(", ")}`,
  };
}

export function checkInputUsed(input: Record<string, unknown>, source: string): SurfaceCheck {
  const unused = Object.keys(input).filter((key) => !source.includes(key));
  return {
    name: "input-used",
    ok: unused.length === 0,
    detail:
      unused.length === 0 ?
        "the component references every input key"
      : `Component.tsx never mentions: ${unused.join(", ")}`,
  };
}

interface MediaValue {
  type: string;
  assetId: string;
}

function isMediaValue(value: unknown): value is MediaValue {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (record["type"] === "image" || record["type"] === "video") && typeof record["assetId"] === "string";
}

export function checkAssetsResolve(input: Record<string, unknown>, knownAssetIds: ReadonlySet<string>): SurfaceCheck {
  const dangling = Object.values(input)
    .filter(isMediaValue)
    .map((value) => value.assetId)
    .filter((assetId) => !knownAssetIds.has(assetId));

  return {
    name: "assets-resolve",
    ok: dangling.length === 0,
    detail:
      dangling.length === 0 ?
        "every media value points at an inventoried asset"
      : `these asset ids are not in assets/media.json: ${dangling.join(", ")}`,
  };
}

export async function checkHarnessRenders(url: string): Promise<SurfaceCheck> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(HARNESS_TIMEOUT_MS) });
    const body = await response.text();
    const ok = response.ok && body.trim() !== "";
    return {
      name: "harness-renders",
      ok,
      detail: ok ? `harness answered ${String(response.status)}` : `harness answered ${String(response.status)}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { name: "harness-renders", ok: false, detail: `harness unreachable: ${message}` };
  }
}
