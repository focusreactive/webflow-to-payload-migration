import type { CollectedNumeric, CollectedShadow } from "#tokens/steps/candidates/services/collect.ts";
import { FONT_WEIGHT_TOLERANCE, NUMERIC_TOLERANCE, mergeNumeric, mergeShadows } from "#tokens/steps/candidates/services/merge.ts";

function numeric(value: number, usageCount: number): CollectedNumeric {
  return { value, usageCount };
}

function shadow(value: string, layers: CollectedShadow["layers"], usageCount: number): CollectedShadow {
  return { value, layers, usageCount };
}

const layer = (over: Partial<CollectedShadow["layers"][number]> = {}): CollectedShadow["layers"][number] => ({
  color: "rgba(0, 0, 0, 0.2)",
  offsetX: 0,
  offsetY: 4,
  blur: 8,
  spread: 0,
  inset: false,
  ...over,
});

describe("mergeNumeric", () => {
  const merge = (values: CollectedNumeric[]) =>
    mergeNumeric(values, { tolerance: NUMERIC_TOLERANCE, idPrefix: "spacing" });

  it("keeps neighbouring design decisions apart at sub-pixel tolerance", () => {
    const merged = merge([numeric(16, 2017), numeric(18, 965), numeric(17, 9)]);

    expect(merged).toEqual([
      { id: "spacing-1", value: 16, usageCount: 2017 },
      { id: "spacing-2", value: 18, usageCount: 965 },
      { id: "spacing-3", value: 17, usageCount: 9 },
    ]);
  });

  it("merges rounding noise into the most-used value", () => {
    expect(merge([numeric(12.99, 40), numeric(13.01, 3)])).toEqual([{ id: "spacing-1", value: 12.99, usageCount: 43 }]);
  });

  it("treats a zero tolerance as exact-match only", () => {
    const merged = mergeNumeric([numeric(400, 10), numeric(401, 1)], {
      tolerance: FONT_WEIGHT_TOLERANCE,
      idPrefix: "font-weight",
    });

    expect(merged.map((entry) => entry.value)).toEqual([400, 401]);
  });
});

describe("mergeShadows", () => {
  it("keeps shadows with different colours apart even at the same blur", () => {
    const merged = mergeShadows([
      shadow("a", [layer()], 12),
      shadow("b", [layer({ color: "rgb(153, 153, 153)", offsetY: 2, blur: 10, spread: -3 })], 4),
    ]);

    expect(merged.map((entry) => entry.value)).toEqual(["a", "b"]);
  });

  it("merges layers that differ only by length formatting", () => {
    const merged = mergeShadows([shadow("a", [layer()], 12), shadow("b", [layer({ offsetX: 0.02 })], 3)]);

    expect(merged).toEqual([{ id: "shadow-1", value: "a", layers: [layer()], usageCount: 15 }]);
  });

  it("keeps shadows with a different layer count apart", () => {
    const merged = mergeShadows([shadow("a", [layer()], 5), shadow("b", [layer(), layer({ blur: 24 })], 2)]);

    expect(merged).toHaveLength(2);
  });
});
