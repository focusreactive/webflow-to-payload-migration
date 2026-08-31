import { describe, expect, it } from "vitest";

import { planRichText } from "#synth/utils/richtext/index.ts";

const FIELDS = [
  { name: "body", label: "Body", type: { type: "richText" as const }, required: true },
  { name: "heading", label: "Heading", type: { type: "text" as const }, required: true },
];

describe("planRichText", () => {
  it("lists only richText fields", () => {
    const plan = planRichText({ fields: FIELDS, literals: { body: { root: { children: [] } }, heading: "T" } });
    expect(plan.map((entry) => entry.field)).toEqual(["body"]);
  });

  it("lists the tags actually present in the lexical value", () => {
    const literals = {
      body: {
        root: {
          children: [
            { type: "heading", tag: "h2", children: [] },
            { type: "paragraph", children: [] },
          ],
        },
      },
    };
    const plan = planRichText({ fields: FIELDS, literals });
    expect(plan[0]?.tags.sort()).toEqual(["h2", "p"]);
  });

  it("returns an empty plan when there are no richText fields", () => {
    const textOnly = FIELDS.filter((field) => field.type.type === "text");
    expect(planRichText({ fields: textOnly, literals: { heading: "T" } })).toEqual([]);
  });
});
