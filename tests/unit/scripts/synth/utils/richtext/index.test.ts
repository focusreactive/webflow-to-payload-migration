import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { emitRichTextWrappers, richTextFieldNames } from "#synth/utils/richtext/index.ts";

describe("richTextFieldNames", () => {
  it("selects only top-level richText fields", () => {
    const fields = [
      { name: "body", type: { type: "richText" as const } },
      { name: "title", type: { type: "text" as const } },
    ];
    expect(richTextFieldNames(fields)).toEqual(["body"]);
  });
});

describe("emitRichTextWrappers", () => {
  it("writes one wrapper file per richText field, from author-supplied measurements", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "rtw-"));
    const written = await emitRichTextWrappers({
      measured: { body: { h2: { "font-size": "32px", "font-weight": "700" } } },
      fields: [{ name: "body", type: { type: "richText" } }],
      tokens: {
        primitive: {
          color: {},
          fontFamily: {},
          fontSize: {},
          fontWeight: {},
          lineHeight: {},
          letterSpacing: {},
          spacing: {},
          radius: {},
          shadow: {},
          breakpoint: {},
        },
        semantic: { color: {} },
        $extensions: { "com.focusreactive.migration": { fontSizeScale: { kind: "modular", ratio: 1.25 } } },
      } as never,
      outDir,
    });
    expect(written).toEqual(["body"]);
    const src = await readFile(join(outDir, "richtext", "body.tsx"), "utf8");
    expect(src).toContain("export default function RichTextBody(");
    expect(src).toContain("[&_h2]:[font-size:32px]");
  });
});
