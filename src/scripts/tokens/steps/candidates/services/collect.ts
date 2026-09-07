import { oklch, parse as parseCssColor } from "culori";

import { round4 } from "#lib/color.ts";

import type { ShadowLayer } from "../../../schemas/token-candidates.ts";

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface CollectedNumeric {
  value: number;
  usageCount: number;
}

export interface CollectedColor {
  value: string;
  oklch: { l: number; c: number; h: number; alpha: number };
  usageCount: number;
}

export interface CollectedRaw {
  value: string;
  usageCount: number;
}

export interface CollectedFontFamily {
  stack: string[];
  usageCount: number;
}

export interface CollectedShadow {
  value: string;
  layers: ShadowLayer[];
  usageCount: number;
}

export interface CollectedBreakpoint {
  valuePx: number;
  usageCount: number;
}

export interface PageStyles {
  route: string;
  elements: Record<string, Record<string, string>>;
}

export interface CollectedTokens {
  colors: CollectedColor[];
  fontFamilies: CollectedFontFamily[];
  fontSizes: CollectedNumeric[];
  fontWeights: CollectedNumeric[];
  lineHeights: CollectedNumeric[];
  letterSpacings: CollectedNumeric[];
  spacings: CollectedNumeric[];
  radii: CollectedNumeric[];
  shadows: CollectedShadow[];
  gradients: CollectedRaw[];
}

const SPACING_PROPS = [
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
] as const;

function parsePx(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const match = /^(-?\d*\.?\d+)px$/.exec(value.trim());
  if (!match) return undefined;
  return round2(Number(match[1]));
}

function splitTopLevel(value: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === delimiter && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

function splitFontStack(raw: string): string[] {
  const families = raw
    .split(",")
    .map((family) => family.trim().replace(/^["']|["']$/g, ""))
    .filter((family) => family !== "");
  return [...new Set(families)];
}

function parseShadowLayer(layer: string): ShadowLayer | undefined {
  const inset = /\binset\b/.test(layer);
  const colorMatch = /(#[0-9a-fA-F]+|[a-zA-Z]+\([^)]*\))/.exec(layer);
  const colorToken = colorMatch?.[1];
  if (colorToken === undefined || parseCssColor(colorToken) === undefined) return undefined;

  const lengths = [...layer.matchAll(/(-?\d*\.?\d+)px/g)].map((match) => round2(Number(match[1])));
  if (lengths.length < 2) return undefined;

  return {
    color: colorToken,
    offsetX: lengths[0] ?? 0,
    offsetY: lengths[1] ?? 0,
    blur: lengths[2] ?? 0,
    spread: lengths[3] ?? 0,
    inset,
  };
}

interface Accumulators {
  colors: Map<string, CollectedColor>;
  fontFamilies: Map<string, CollectedFontFamily>;
  fontSizes: Map<number, CollectedNumeric>;
  fontWeights: Map<number, CollectedNumeric>;
  lineHeights: Map<number, CollectedNumeric>;
  letterSpacings: Map<number, CollectedNumeric>;
  spacings: Map<number, CollectedNumeric>;
  radii: Map<number, CollectedNumeric>;
  shadows: Map<string, CollectedShadow>;
  gradients: Map<string, CollectedRaw>;
}

function addNumeric(map: Map<number, CollectedNumeric>, value: number): void {
  const entry = map.get(value) ?? { value, usageCount: 0 };
  entry.usageCount += 1;
  map.set(value, entry);
}

function addColor(map: Map<string, CollectedColor>, raw: string): void {
  const value = raw.trim();
  const parsed = parseCssColor(value);
  if (parsed === undefined) return;
  const converted = oklch(parsed);
  const alpha = converted.alpha ?? 1;
  if (alpha === 0) return;

  const entry = map.get(value) ?? {
    value,
    oklch: {
      l: round4(converted.l ?? 0),
      c: round4(converted.c ?? 0),
      h: round4(converted.h ?? 0),
      alpha: round4(alpha),
    },
    usageCount: 0,
  };
  entry.usageCount += 1;
  map.set(value, entry);
}

function hasVisibleBorder(props: Record<string, string>): boolean {
  const style = props["border-style"] ?? "";
  const widths = (props["border-width"] ?? "")
    .split(/\s+/)
    .map((part) => parsePx(part))
    .filter((width): width is number => width !== undefined && width > 0);
  return widths.length > 0 && style.split(/\s+/).some((part) => part !== "" && part !== "none");
}

function collectElement(acc: Accumulators, props: Record<string, string>): void {
  for (const prop of ["color", "background-color"] as const) {
    const value = props[prop];
    if (value !== undefined) addColor(acc.colors, value);
  }

  if (hasVisibleBorder(props)) {
    for (const part of splitTopLevel(props["border-color"] ?? "", " ")) {
      addColor(acc.colors, part);
    }
  }

  const familyRaw = props["font-family"];
  if (familyRaw !== undefined && familyRaw.trim() !== "") {
    const stack = splitFontStack(familyRaw.trim());
    const key = stack.join(",");
    if (stack.length > 0) {
      const entry = acc.fontFamilies.get(key) ?? { stack, usageCount: 0 };
      entry.usageCount += 1;
      acc.fontFamilies.set(key, entry);
    }
  }

  const fontSize = parsePx(props["font-size"]);
  if (fontSize !== undefined && fontSize > 0) addNumeric(acc.fontSizes, fontSize);

  const weight = Number(props["font-weight"] ?? "");
  if (Number.isInteger(weight) && weight > 0) addNumeric(acc.fontWeights, weight);

  const lineHeight = parsePx(props["line-height"]);
  if (lineHeight !== undefined && lineHeight > 0) addNumeric(acc.lineHeights, lineHeight);

  const letterSpacing = parsePx(props["letter-spacing"]);
  if (letterSpacing !== undefined && letterSpacing !== 0) addNumeric(acc.letterSpacings, letterSpacing);

  for (const prop of SPACING_PROPS) {
    const value = parsePx(props[prop]);
    if (value !== undefined && value > 0) addNumeric(acc.spacings, value);
  }
  for (const part of (props["gap"] ?? "").split(/\s+/)) {
    const value = parsePx(part);
    if (value !== undefined && value > 0) addNumeric(acc.spacings, value);
  }

  const radius = parsePx(props["border-top-left-radius"]);
  if (radius !== undefined && radius > 0) addNumeric(acc.radii, radius);

  const shadowRaw = (props["box-shadow"] ?? "").trim();
  if (shadowRaw !== "" && shadowRaw !== "none") {
    const layers = splitTopLevel(shadowRaw, ",").map(parseShadowLayer);
    if (layers.length > 0 && layers.every((layer): layer is ShadowLayer => layer !== undefined)) {
      const entry = acc.shadows.get(shadowRaw) ?? { value: shadowRaw, layers, usageCount: 0 };
      entry.usageCount += 1;
      acc.shadows.set(shadowRaw, entry);
    }
  }

  const backgroundImage = (props["background-image"] ?? "").trim();
  if (backgroundImage.includes("gradient(")) {
    const entry = acc.gradients.get(backgroundImage) ?? { value: backgroundImage, usageCount: 0 };
    entry.usageCount += 1;
    acc.gradients.set(backgroundImage, entry);
  }
}

function byUsageThenNumber(a: CollectedNumeric, b: CollectedNumeric): number {
  return b.usageCount - a.usageCount || a.value - b.value;
}

function byUsageThenString<T extends { usageCount: number; value: string }>(a: T, b: T): number {
  return b.usageCount - a.usageCount || a.value.localeCompare(b.value);
}

export function collectFromStyles(pages: PageStyles[]): CollectedTokens {
  const acc: Accumulators = {
    colors: new Map(),
    fontFamilies: new Map(),
    fontSizes: new Map(),
    fontWeights: new Map(),
    lineHeights: new Map(),
    letterSpacings: new Map(),
    spacings: new Map(),
    radii: new Map(),
    shadows: new Map(),
    gradients: new Map(),
  };

  for (const pageEntry of [...pages].sort((a, b) => a.route.localeCompare(b.route))) {
    for (const props of Object.values(pageEntry.elements)) {
      collectElement(acc, props);
    }
  }

  const sortedNumeric = (map: Map<number, CollectedNumeric>): CollectedNumeric[] =>
    [...map.values()].sort(byUsageThenNumber);

  return {
    colors: [...acc.colors.values()].sort(byUsageThenString),
    fontFamilies: [...acc.fontFamilies.values()].sort(
      (a, b) => b.usageCount - a.usageCount || a.stack.join(",").localeCompare(b.stack.join(",")),
    ),
    fontSizes: sortedNumeric(acc.fontSizes),
    fontWeights: sortedNumeric(acc.fontWeights),
    lineHeights: sortedNumeric(acc.lineHeights),
    letterSpacings: sortedNumeric(acc.letterSpacings),
    spacings: sortedNumeric(acc.spacings),
    radii: sortedNumeric(acc.radii),
    shadows: [...acc.shadows.values()].sort(byUsageThenString),
    gradients: [...acc.gradients.values()].sort(byUsageThenString),
  };
}

const MEDIA_MIN_WIDTH_PATTERN = /\(\s*min-width\s*:\s*(\d*\.?\d+)(px|em|rem)\s*\)/gi;

export function collectBreakpoints(cssTexts: string[]): CollectedBreakpoint[] {
  const found = new Map<number, CollectedBreakpoint>();

  for (const css of cssTexts) {
    let index = css.indexOf("@media");
    while (index !== -1) {
      const braceIndex = css.indexOf("{", index);
      const prelude = css.slice(index, braceIndex === -1 ? css.length : braceIndex);
      for (const match of prelude.matchAll(MEDIA_MIN_WIDTH_PATTERN)) {
        const raw = Number(match[1]);
        const valuePx = Math.round(match[2] === "px" ? raw : raw * 16);
        const entry = found.get(valuePx) ?? { valuePx, usageCount: 0 };
        entry.usageCount += 1;
        found.set(valuePx, entry);
      }
      index = css.indexOf("@media", index + "@media".length);
    }
  }

  return [...found.values()].sort((a, b) => b.usageCount - a.usageCount || a.valuePx - b.valuePx);
}
