import type { RichTextTag, TagCategory } from "./types.ts";

export const SUPPORTED_TAGS: readonly RichTextTag[] = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "a",
  "strong",
  "em",
  "u",
  "s",
  "blockquote",
  "code",
  "hr",
  "img",
];

const TAG_ALIASES: Record<string, RichTextTag> = { b: "strong", i: "em" };
const SUPPORTED = new Set<string>(SUPPORTED_TAGS);

export function normalizeTag(raw: string): RichTextTag {
  return supportedTagOf(raw) ?? "p";
}

export function supportedTagOf(raw: string): RichTextTag | undefined {
  const lower = raw.trim().toLowerCase();
  const aliased = TAG_ALIASES[lower] ?? lower;
  return SUPPORTED.has(aliased) ? (aliased as RichTextTag) : undefined;
}

export function categoryOf(tag: RichTextTag): TagCategory {
  switch (tag) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return "heading";
    case "ul":
    case "ol":
      return "list";
    case "li":
      return "listitem";
    case "a":
      return "link";
    case "strong":
    case "em":
    case "u":
    case "s":
      return "inline";
    case "blockquote":
      return "quote";
    case "code":
      return "code";
    case "hr":
      return "rule";
    case "img":
      return "image";
    case "p":
      return "paragraph";
  }
}

export const RELEVANT_PROPS: Record<TagCategory, readonly string[]> = {
  paragraph: [
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "color",
    "text-align",
    "text-transform",
    "margin-top",
    "margin-bottom",
  ],
  heading: [
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "color",
    "text-align",
    "text-transform",
    "margin-top",
    "margin-bottom",
  ],
  quote: [
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "color",
    "font-style",
    "margin-top",
    "margin-bottom",
    "padding-left",
  ],
  listitem: ["font-family", "font-size", "font-weight", "line-height", "color", "margin-top", "margin-bottom"],
  list: ["list-style-type", "margin-top", "margin-bottom", "padding-left"],
  inline: ["font-weight", "font-style", "text-decoration"],
  link: ["color", "text-decoration", "font-weight"],
  code: ["font-family", "font-size", "color", "background-color"],
  rule: ["border-color", "border-width", "border-style", "margin-top", "margin-bottom"],
  image: [],
};
