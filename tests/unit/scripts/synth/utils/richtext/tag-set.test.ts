import { describe, expect, it } from "vitest";

import {
  RELEVANT_PROPS,
  SUPPORTED_TAGS,
  categoryOf,
  normalizeTag,
  supportedTagOf,
} from "#synth/utils/richtext/tag-set.ts";

describe("supportedTagOf", () => {
  it("resolves supported tags and aliases", () => {
    expect(supportedTagOf("H2")).toBe("h2");
    expect(supportedTagOf("b")).toBe("strong");
  });
  it("returns undefined for unsupported tags instead of collapsing to p", () => {
    expect(supportedTagOf("div")).toBeUndefined();
    expect(supportedTagOf("section")).toBeUndefined();
    expect(supportedTagOf("span")).toBeUndefined();
    expect(supportedTagOf("br")).toBeUndefined();
  });
});

describe("normalizeTag", () => {
  it("keeps supported tags and lowercases", () => {
    expect(normalizeTag("H2")).toBe("h2");
    expect(normalizeTag("blockquote")).toBe("blockquote");
  });
  it("aliases b→strong and i→em", () => {
    expect(normalizeTag("b")).toBe("strong");
    expect(normalizeTag("i")).toBe("em");
  });
  it("collapses unknown tags to p", () => {
    expect(normalizeTag("span")).toBe("p");
    expect(normalizeTag("table")).toBe("p");
  });
});

describe("categoryOf", () => {
  it("maps tags to categories", () => {
    expect(categoryOf("h3")).toBe("heading");
    expect(categoryOf("ul")).toBe("list");
    expect(categoryOf("li")).toBe("listitem");
    expect(categoryOf("a")).toBe("link");
    expect(categoryOf("strong")).toBe("inline");
    expect(categoryOf("blockquote")).toBe("quote");
    expect(categoryOf("code")).toBe("code");
    expect(categoryOf("hr")).toBe("rule");
    expect(categoryOf("img")).toBe("image");
    expect(categoryOf("p")).toBe("paragraph");
  });
});

describe("RELEVANT_PROPS", () => {
  it("gives headings typography props but not list-style-type", () => {
    expect(RELEVANT_PROPS.heading).toContain("font-size");
    expect(RELEVANT_PROPS.heading).not.toContain("list-style-type");
  });
  it("gives lists list-style-type", () => {
    expect(RELEVANT_PROPS.list).toContain("list-style-type");
  });
  it("every supported tag has a defined relevant-prop list via its category", () => {
    for (const tag of SUPPORTED_TAGS) {
      expect(Array.isArray(RELEVANT_PROPS[categoryOf(tag)])).toBe(true);
    }
  });
});
