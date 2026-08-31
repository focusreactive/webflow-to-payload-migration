import { semanticColorToCss } from "#lib/semantic-color.ts";

import type { DesignTokensData, DtcgColorValue } from "../../../schemas/design-tokens.ts";

const formatNumber = (value: number): string => String(value);

export function formatOklch(color: DtcgColorValue): string {
  const [l, c, h] = color.components;
  const base = `${formatNumber(l)} ${formatNumber(c)} ${formatNumber(h)}`;
  return color.alpha < 1 ? `oklch(${base} / ${formatNumber(color.alpha)})` : `oklch(${base})`;
}

const formatPx = (dimension: { value: number }): string => `${formatNumber(dimension.value)}px`;

function formatFamily(family: string): string {
  return /^[a-zA-Z][a-zA-Z-]*$/.test(family) ? family : `"${family}"`;
}

function sortedEntries<T>(record: Record<string, T>): [string, T][] {
  return Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
}

export function emitThemeCss(data: DesignTokensData): string {
  const lines: string[] = [];
  const { primitive, semantic } = data;

  for (const [name, token] of sortedEntries(primitive.color)) {
    lines.push(`--color-${name}: ${formatOklch(token.$value)};`);
  }
  for (const [name, token] of sortedEntries(semantic.color)) {
    lines.push(`--color-${name}: ${semanticColorToCss(token.$value)};`);
  }
  for (const [name, token] of sortedEntries(primitive.fontFamily)) {
    lines.push(`--font-${name}: ${token.$value.map(formatFamily).join(", ")};`);
  }
  for (const [name, token] of sortedEntries(primitive.fontSize)) {
    lines.push(`--text-${name}: ${formatPx(token.$value)};`);
  }
  for (const [name, token] of sortedEntries(primitive.fontWeight)) {
    lines.push(`--font-weight-${name}: ${formatNumber(token.$value)};`);
  }
  for (const [name, token] of sortedEntries(primitive.lineHeight)) {
    lines.push(`--leading-${name}: ${formatPx(token.$value)};`);
  }
  for (const [name, token] of sortedEntries(primitive.letterSpacing)) {
    lines.push(`--tracking-${name}: ${formatPx(token.$value)};`);
  }
  for (const [name, token] of sortedEntries(primitive.spacing)) {
    lines.push(`--spacing-${name}: ${formatPx(token.$value)};`);
  }
  for (const [name, token] of sortedEntries(primitive.radius)) {
    lines.push(`--radius-${name}: ${formatPx(token.$value)};`);
  }
  for (const [name, token] of sortedEntries(primitive.shadow)) {
    const value = token.$value
      .map(
        (layer) =>
          `${layer.inset ? "inset " : ""}${formatPx(layer.offsetX)} ${formatPx(layer.offsetY)} `
          + `${formatPx(layer.blur)} ${formatPx(layer.spread)} ${formatOklch(layer.color)}`,
      )
      .join(", ");
    lines.push(`--shadow-${name}: ${value};`);
  }
  for (const [name, token] of sortedEntries(primitive.breakpoint)) {
    lines.push(`--breakpoint-${name}: ${formatPx(token.$value)};`);
  }

  if (lines.length === 0) return "@theme {}\n";
  return `@theme {\n${lines.map((line) => `  ${line}`).join("\n")}\n}\n`;
}
