import { formatHex, oklch, parse as parseCssColor } from "culori";

import { round4 } from "#lib/color.ts";

import type { DesignTokensData, DtcgColorValue } from "../../../schemas/design-tokens.ts";
import type { TokensResponse } from "../../../schemas/judgement-response-schema.ts";
import type { TokenCandidatesData } from "../../../schemas/token-candidates.ts";

type Primitive = DesignTokensData["primitive"];

export function toDtcgColor(raw: string): DtcgColorValue {
  const parsed = parseCssColor(raw);
  if (parsed === undefined) throw new Error(`assemble: unparsable color '${raw}' escaped collection`);
  const converted = oklch(parsed);
  return {
    colorSpace: "oklch",
    components: [round4(converted.l ?? 0), round4(converted.c ?? 0), round4(converted.h ?? 0)],
    alpha: round4(converted.alpha ?? 1),
    hex: formatHex(parsed),
  };
}

const px = (value: number): { value: number; unit: "px" } => ({ value, unit: "px" });

function namesById(verdicts: { candidateId: string; name: string }[]): Map<string, string> {
  return new Map(verdicts.map((verdict) => [verdict.candidateId, verdict.name]));
}

function group<C extends { id: string }, T>(
  candidates: C[],
  verdicts: { candidateId: string; name: string }[],
  toToken: (candidate: C) => T,
): Record<string, T> {
  const names = namesById(verdicts);
  const tokens: Record<string, T> = {};
  for (const candidate of candidates) {
    const name = names.get(candidate.id);
    if (name !== undefined) tokens[name] = toToken(candidate);
  }
  return tokens;
}

function dimensions(
  candidates: { id: string; value: number }[],
  verdicts: { candidateId: string; name: string }[],
): Primitive["fontSize"] {
  return group(candidates, verdicts, (candidate) => ({ $type: "dimension" as const, $value: px(candidate.value) }));
}

export function assembleDesignTokens(opts: {
  candidates: TokenCandidatesData;
  response: TokensResponse;
}): DesignTokensData {
  const { candidates, response } = opts;

  return {
    primitive: {
      color: group(candidates.colors, response.colors.primitives, (candidate) => ({
        $type: "color" as const,
        $value: toDtcgColor(candidate.value),
      })),
      fontFamily: group(candidates.fontFamilies, response.fontFamilies, (candidate) => ({
        $type: "fontFamily" as const,
        $value: candidate.stack,
      })),
      fontSize: dimensions(candidates.fontSizes, response.fontSizes),
      fontWeight: group(candidates.fontWeights, response.fontWeights, (candidate) => ({
        $type: "fontWeight" as const,
        $value: candidate.value,
      })),
      lineHeight: dimensions(candidates.lineHeights, response.lineHeights),
      letterSpacing: dimensions(candidates.letterSpacings, response.letterSpacings),
      spacing: dimensions(candidates.spacings, response.spacings),
      radius: dimensions(candidates.radii, response.radii),
      shadow: group(candidates.shadows, response.shadows, (candidate) => ({
        $type: "shadow" as const,
        $value: candidate.layers.map((layer) => ({
          color: toDtcgColor(layer.color),
          offsetX: px(layer.offsetX),
          offsetY: px(layer.offsetY),
          blur: px(layer.blur),
          spread: px(layer.spread),
          inset: layer.inset,
        })),
      })),
      breakpoint: group(candidates.breakpoints, response.breakpoints, (candidate) => ({
        $type: "dimension" as const,
        $value: px(candidate.valuePx),
      })),
    },
    semantic: {
      color: Object.fromEntries(
        response.colors.roles.map((role) => [role.name, { $type: "color" as const, $value: role.value }]),
      ),
    },
  };
}
