import { SUPPORTED_TAGS, categoryOf } from "./tag-set.ts";
import type { RichTextStyleTable, RichTextTag, TagStyle } from "./types.ts";

const HEADING_LEVEL: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };
const DEFAULT_BODY_PX = 16;
export const DEFAULT_SCALE_RATIO = 1.25;

export interface ExtrapolateOpts {
  scaleRatio?: number;
}

function px(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const match = /^(-?\d*\.?\d+)px$/.exec(value.trim());
  return match === null ? undefined : Number(match[1]);
}

export function extrapolateTable(measured: RichTextStyleTable, opts: ExtrapolateOpts = {}): RichTextStyleTable {
  const out: RichTextStyleTable = { ...measured };
  const bodyPx = px(measured.p?.props["font-size"]) ?? DEFAULT_BODY_PX;

  for (const tag of SUPPORTED_TAGS) {
    if (out[tag] !== undefined) continue;
    if (categoryOf(tag) === "image") continue;
    const style = extrapolateTag(tag, measured, bodyPx, opts.scaleRatio ?? DEFAULT_SCALE_RATIO);
    if (style !== undefined) out[tag] = style;
  }
  return out;
}

function extrapolateTag(
  tag: RichTextTag,
  measured: RichTextStyleTable,
  bodyPx: number,
  ratio: number,
): TagStyle | undefined {
  const level = HEADING_LEVEL[tag];
  if (level !== undefined) {
    const size = extrapolateHeadingPx(level, measured, bodyPx, ratio);
    return {
      props: {
        "font-size": `${Math.round(size)}px`,
        "font-weight": measured.h2?.props["font-weight"] ?? "700",
        "line-height": "1.2",
        "margin-bottom": "0.5em",
      },
      source: "extrapolated",
    };
  }
  switch (tag) {
    case "strong":
      return { props: { "font-weight": "700" }, source: "extrapolated" };
    case "em":
      return { props: { "font-style": "italic" }, source: "extrapolated" };
    case "u":
      return { props: { "text-decoration": "underline" }, source: "extrapolated" };
    case "s":
      return { props: { "text-decoration": "line-through" }, source: "extrapolated" };
    case "a": {
      const color = measured.p?.props.color;
      return {
        props: { "text-decoration": "underline", ...(color !== undefined ? { color } : {}) },
        source: "extrapolated",
      };
    }
    case "ul":
      return {
        props: { "list-style-type": "disc", "padding-left": "1.5em", "margin-bottom": "1em" },
        source: "extrapolated",
      };
    case "ol":
      return {
        props: { "list-style-type": "decimal", "padding-left": "1.5em", "margin-bottom": "1em" },
        source: "extrapolated",
      };
    case "li":
      return { props: { "margin-bottom": "0.25em" }, source: "extrapolated" };
    case "blockquote":
      return {
        props: { "padding-left": "1em", "font-style": "italic", "margin-bottom": "1em" },
        source: "extrapolated",
      };
    case "code":
      return { props: { "font-family": "monospace" }, source: "extrapolated" };
    case "hr":
      return {
        props: { "border-top-width": "1px", "border-top-style": "solid", "margin-top": "1em", "margin-bottom": "1em" },
        source: "extrapolated",
      };
    case "p":
      return { props: { "font-size": `${bodyPx}px`, "margin-bottom": "1em" }, source: "extrapolated" };
    default:
      return undefined;
  }
}

function extrapolateHeadingPx(level: number, measured: RichTextStyleTable, bodyPx: number, ratio: number): number {
  const anchors: { level: number; size: number }[] = [];
  for (const [tag, style] of Object.entries(measured)) {
    const lvl = HEADING_LEVEL[tag];
    const size = px(style?.props["font-size"]);
    if (lvl !== undefined && size !== undefined) anchors.push({ level: lvl, size });
  }
  anchors.push({ level: 7, size: bodyPx });
  anchors.sort((a, b) => a.level - b.level);

  let upper: { level: number; size: number } | undefined;
  let lower: { level: number; size: number } | undefined;
  for (const anchor of anchors) {
    if (anchor.level < level) upper = anchor;
    else if (anchor.level > level && lower === undefined) lower = anchor;
  }

  if (upper !== undefined && lower !== undefined) {
    if (upper.size <= 0 || lower.size <= 0) return upper.size;
    const t = (level - upper.level) / (lower.level - upper.level);
    return upper.size * (lower.size / upper.size) ** t;
  }
  const anchor = upper ?? lower ?? { level: 7, size: bodyPx };
  return anchor.size * ratio ** (anchor.level - level);
}
