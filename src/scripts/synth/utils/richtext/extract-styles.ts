import type { ColorCandidate } from "./color-match.ts";
import { resolveColor } from "./color-match.ts";
import { RELEVANT_PROPS, categoryOf, supportedTagOf } from "./tag-set.ts";
import type { RichTextStyleTable, RichTextTag, TagStyle } from "./types.ts";

const COLOR_PROPS = new Set(["color", "background-color", "border-color"]);

export function styleTableFromMeasured(
  measured: Record<string, Record<string, string>>,
  colorCandidates: ColorCandidate[],
): RichTextStyleTable {
  const table: RichTextStyleTable = {};
  for (const [rawTag, props] of Object.entries(measured)) {
    const tag = supportedTagOf(rawTag);
    if (tag === undefined || categoryOf(tag) === "image") continue;
    const style = toTagStyle(tag, props, colorCandidates);
    if (Object.keys(style.props).length > 0) table[tag] = style;
  }
  return table;
}

function toTagStyle(tag: RichTextTag, props: Record<string, string>, candidates: ColorCandidate[]): TagStyle {
  const relevant = RELEVANT_PROPS[categoryOf(tag)];
  const out: Record<string, string> = {};
  for (const prop of relevant) {
    const value = props[prop];
    if (value === undefined || value === "" || value === "normal" || value === "none" || value === "auto") continue;
    out[prop] = COLOR_PROPS.has(prop) ? resolveColor(value, candidates) : value;
  }
  return { props: out, source: "measured" };
}
