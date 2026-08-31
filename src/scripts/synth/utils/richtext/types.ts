import type { FieldType } from "#ir/field-type.ts";

export interface RichTextField {
  name: string;
  type: FieldType;
}

export type RichTextTag =
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "ul"
  | "ol"
  | "li"
  | "a"
  | "strong"
  | "em"
  | "u"
  | "s"
  | "blockquote"
  | "code"
  | "hr"
  | "img";

export type TagCategory =
  "paragraph" | "heading" | "list" | "listitem" | "inline" | "link" | "quote" | "code" | "rule" | "image";

export interface TagStyle {
  props: Record<string, string>;
  source: "measured" | "extrapolated";
}

export type RichTextStyleTable = Partial<Record<RichTextTag, TagStyle>>;
