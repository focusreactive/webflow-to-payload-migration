import { z } from "zod";

import {
  buildIngestRecordSchema,
  collectAssetIds,
  llmValueSchemaForFieldType,
  pruneNullValues,
  valueSchemaForFieldType,
} from "#ir/field-value.ts";
import type { FieldType } from "#ir/field-type.ts";
import { toLlmJsonSchema } from "#ir/llm-contract.ts";

const faqField: FieldType = {
  type: "array",
  element: {
    type: "group",
    fields: [
      { name: "question", type: { type: "text" }, required: true },
      { name: "answer", type: { type: "richText" }, required: false },
    ],
  },
};

describe("valueSchemaForFieldType (IR pass)", () => {
  it("validates scalars", () => {
    expect(valueSchemaForFieldType({ type: "number" }).safeParse(3).success).toBe(true);
    expect(valueSchemaForFieldType({ type: "number" }).safeParse("3").success).toBe(false);
    expect(valueSchemaForFieldType({ type: "text" }).safeParse("hi").success).toBe(true);
  });

  it("accepts only ISO-8601 date-times for a date field", () => {
    const schema = valueSchemaForFieldType({ type: "date" });
    expect(schema.safeParse("2025-08-12T00:00:00.000Z").success).toBe(true);
    expect(schema.safeParse("2025-08-12T09:30:00+02:00").success).toBe(true);
    expect(schema.safeParse("2025-08-12").success).toBe(false);
    const parsed = schema.safeParse("August 12, 2025");
    expect(parsed.success).toBe(false);
    expect(z.prettifyError(parsed.error!)).toMatch(/ISO-8601/);
    expect(z.prettifyError(parsed.error!)).toMatch(/Component\.tsx/);
  });

  it("validates MediaRef for image/file/video", () => {
    expect(valueSchemaForFieldType({ type: "image" }).safeParse({ assetId: "a1", alt: "x" }).success).toBe(true);
    expect(valueSchemaForFieldType({ type: "image" }).safeParse("https://cdn/img.png").success).toBe(false);
    expect(valueSchemaForFieldType({ type: "video" }).safeParse({ assetId: "a1" }).success).toBe(true);
    expect(valueSchemaForFieldType({ type: "video" }).safeParse("https://cdn/hero.mp4").success).toBe(false);
  });

  it("validates option against declared values", () => {
    const schema = valueSchemaForFieldType({ type: "option", values: ["red", "blue"] });
    expect(schema.safeParse("red").success).toBe(true);
    expect(schema.safeParse("green").success).toBe(false);
  });

  it("validates nested array<group> with optional subfields", () => {
    const schema = valueSchemaForFieldType(faqField);
    expect(schema.safeParse([{ question: "Q1", answer: "<p>A1</p>" }, { question: "Q2" }]).success).toBe(true);
    expect(schema.safeParse([{ answer: "<p>no question</p>" }]).success).toBe(false);
    expect(schema.safeParse([{ question: "Q1", extra: 1 }]).success).toBe(false);
  });
});

describe("llmValueSchemaForFieldType (LLM projection)", () => {
  it("emits an llm-legal schema for a nested field (all keys required, no records)", () => {
    const emitted = toLlmJsonSchema(z.object({ value: llmValueSchemaForFieldType(faqField) }));
    expect(JSON.stringify(emitted)).not.toContain("$ref");
  });

  it("models optional subfields and alt as nullable", () => {
    const schema = llmValueSchemaForFieldType(faqField);
    expect(schema.safeParse([{ question: "Q1", answer: null }]).success).toBe(true);
    const image = llmValueSchemaForFieldType({ type: "image" });
    expect(image.safeParse({ assetId: "a1", alt: null }).success).toBe(true);
    const video = llmValueSchemaForFieldType({ type: "video" });
    expect(video.safeParse({ assetId: "a1", alt: null }).success).toBe(true);
  });
});

describe("pruneNullValues", () => {
  it("drops null object entries recursively, keeps arrays intact", () => {
    expect(pruneNullValues({ a: null, b: { c: null, d: 1 }, e: [1, 2] })).toEqual({ b: { d: 1 }, e: [1, 2] });
  });
});

describe("collectAssetIds", () => {
  it("collects ids from media refs nested in arrays and groups", () => {
    const field: FieldType = {
      type: "array",
      element: {
        type: "group",
        fields: [{ name: "logo", type: { type: "image" }, required: true }],
      },
    };
    expect(collectAssetIds(field, [{ logo: { assetId: "a1" } }, { logo: { assetId: "a2" } }])).toEqual(["a1", "a2"]);
    expect(collectAssetIds({ type: "video" }, { assetId: "a3" })).toEqual(["a3"]);
    expect(collectAssetIds({ type: "text" }, "no assets")).toEqual([]);
  });
});

describe("buildIngestRecordSchema (AI payload → canonical record)", () => {
  const fields = [
    { name: "logo", type: { type: "image" } as FieldType, required: true },
    { name: "eyebrow", type: { type: "text" } as FieldType, required: false },
    {
      name: "cta",
      type: {
        type: "group",
        fields: [
          { name: "label", type: { type: "text" }, required: true },
          { name: "href", type: { type: "text" }, required: false },
        ],
      } as FieldType,
      required: true,
    },
  ];

  it("accepts alt: null on a media value and stores the ref without alt", () => {
    const parsed = buildIngestRecordSchema(fields).safeParse({
      logo: { assetId: "a1", alt: null },
      cta: { label: "Go" },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ logo: { assetId: "a1" }, cta: { label: "Go" } });
  });

  it("accepts null for an optional top-level field and drops the key", () => {
    const parsed = buildIngestRecordSchema(fields).safeParse({
      logo: { assetId: "a1" },
      eyebrow: null,
      cta: { label: "Go" },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ logo: { assetId: "a1" }, cta: { label: "Go" } });
  });

  it("accepts null for an optional sub-field inside a group and drops the key", () => {
    const parsed = buildIngestRecordSchema(fields).safeParse({
      logo: { assetId: "a1" },
      cta: { label: "Go", href: null },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ logo: { assetId: "a1" }, cta: { label: "Go" } });
  });

  it("rejects null for a required field, naming the field and why", () => {
    const parsed = buildIngestRecordSchema(fields).safeParse({ logo: null, cta: { label: "Go" } });
    expect(parsed.success).toBe(false);
    expect(z.prettifyError(parsed.error!)).toMatch(/logo/);
    expect(z.prettifyError(parsed.error!)).toMatch(/required/i);
  });

  it("rejects null for a required sub-field inside a group, naming its path", () => {
    const parsed = buildIngestRecordSchema(fields).safeParse({
      logo: { assetId: "a1" },
      cta: { label: null },
    });
    expect(parsed.success).toBe(false);
    expect(z.prettifyError(parsed.error!)).toMatch(/cta.*label|label/s);
  });

  it("still rejects unknown slugs and wrong types", () => {
    const schema = buildIngestRecordSchema(fields);
    expect(schema.safeParse({ logo: { assetId: "a1" }, cta: { label: "Go" }, ghost: 1 }).success).toBe(false);
    expect(schema.safeParse({ logo: "not-a-ref", cta: { label: "Go" } }).success).toBe(false);
    expect(schema.safeParse({ cta: { label: "Go" } }).success).toBe(false);
  });
});
