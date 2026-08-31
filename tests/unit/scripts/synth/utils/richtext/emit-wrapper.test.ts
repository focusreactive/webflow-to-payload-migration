import { describe, expect, it } from "vitest";

import { emitRichTextWrapper } from "#synth/utils/richtext/emit-wrapper.ts";
import { richTextWrapperImport, richTextWrapperName } from "#synth/utils/richtext/names.ts";
import type { RichTextStyleTable } from "#synth/utils/richtext/types.ts";

describe("names", () => {
  it("PascalCases the slug", () => {
    expect(richTextWrapperName("body")).toBe("RichTextBody");
    expect(richTextWrapperName("short-description")).toBe("RichTextShortDescription");
  });
  it("import path is relative and extensionless", () => {
    expect(richTextWrapperImport("body")).toBe("./richtext/body");
  });
});

describe("emitRichTextWrapper", () => {
  const table: RichTextStyleTable = {
    h2: { props: { "font-size": "32px", "font-weight": "700", color: "var(--color-primary)" }, source: "measured" },
    a: { props: { "text-decoration": "underline", color: "var(--color-accent)" }, source: "extrapolated" },
  };
  const src = emitRichTextWrapper("body", table);

  it("imports RichText and the type, exports the PascalCase component", () => {
    expect(src).toContain('import { RichText } from "@payloadcms/richtext-lexical/react";');
    expect(src).toContain('from "@payloadcms/richtext-lexical/lexical"');
    expect(src).toContain("export default function RichTextBody(");
  });
  it("emits arbitrary-property descendant variants per tag/prop", () => {
    expect(src).toContain("[&_h2]:[font-size:32px]");
    expect(src).toContain("[&_h2]:[font-weight:700]");
    expect(src).toContain("[&_h2]:[color:var(--color-primary)]");
    expect(src).toContain("[&_a]:[text-decoration:underline]");
  });
  it("escapes spaces in multi-value props as underscores, not by deleting them", () => {
    const src2 = emitRichTextWrapper("body", {
      hr: { props: { "border-width": "0px 0px 0px 3px" }, source: "measured" },
      p: { props: { "font-family": "Montserrat, sans-serif" }, source: "measured" },
    });
    expect(src2).toContain("[&_hr]:[border-width:0px_0px_0px_3px]");
    expect(src2).toContain("[&_p]:[font-family:Montserrat,_sans-serif]");
  });

  it("forwards rest props (data-mig-id) onto the wrapper root and renders RichText", () => {
    expect(src).toContain("{...rest}");
    expect(src).toContain("<RichText data={data} />");
  });
});
