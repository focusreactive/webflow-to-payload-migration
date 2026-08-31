import type { NumericCandidate, ShadowCandidate, ShadowLayer } from "../../../schemas/token-candidates.ts";
import type { CollectedNumeric, CollectedShadow } from "./collect.ts";

export const NUMERIC_TOLERANCE = 0.05;
export const FONT_WEIGHT_TOLERANCE = 0;

function byUsageThenValue(a: CollectedNumeric, b: CollectedNumeric): number {
  return b.usageCount - a.usageCount || a.value - b.value;
}

function mergedCandidate(members: CollectedNumeric[]): CollectedNumeric {
  const canon = [...members].sort(byUsageThenValue)[0];
  if (canon === undefined) throw new Error("merge: empty group");
  return {
    value: canon.value,
    usageCount: members.reduce((sum, member) => sum + member.usageCount, 0),
  };
}

export function mergeNumeric(
  values: CollectedNumeric[],
  opts: { tolerance: number; idPrefix: string },
): NumericCandidate[] {
  const ascending = [...values].sort((a, b) => a.value - b.value);

  const groups: CollectedNumeric[][] = [];
  for (const entry of ascending) {
    const current = groups.at(-1);
    const start = current?.[0];

    if (current !== undefined && start !== undefined && entry.value - start.value <= opts.tolerance) {
      current.push(entry);
    } else {
      groups.push([entry]);
    }
  }

  return groups
    .map(mergedCandidate)
    .sort(byUsageThenValue)
    .map((candidate, index) => ({ id: `${opts.idPrefix}-${index + 1}`, ...candidate }));
}

function layersMatch(a: ShadowLayer[], b: ShadowLayer[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((layer, index) => {
    const other = b[index];
    if (other === undefined) return false;
    return (
      layer.color === other.color
      && layer.inset === other.inset
      && Math.abs(layer.offsetX - other.offsetX) <= NUMERIC_TOLERANCE
      && Math.abs(layer.offsetY - other.offsetY) <= NUMERIC_TOLERANCE
      && Math.abs(layer.blur - other.blur) <= NUMERIC_TOLERANCE
      && Math.abs(layer.spread - other.spread) <= NUMERIC_TOLERANCE
    );
  });
}

export function mergeShadows(shadows: CollectedShadow[]): ShadowCandidate[] {
  const sorted = [...shadows].sort((a, b) => b.usageCount - a.usageCount || a.value.localeCompare(b.value));

  const groups: CollectedShadow[][] = [];
  for (const shadow of sorted) {
    const host = groups.find((group) => group[0] !== undefined && layersMatch(group[0].layers, shadow.layers));
    if (host) host.push(shadow);
    else groups.push([shadow]);
  }

  return groups
    .map((members) => {
      const canon = members[0];
      if (canon === undefined) throw new Error("merge: empty shadow group");
      return {
        value: canon.value,
        layers: canon.layers,
        usageCount: members.reduce((sum, member) => sum + member.usageCount, 0),
      };
    })
    .sort((a, b) => b.usageCount - a.usageCount || a.value.localeCompare(b.value))
    .map((candidate, index) => ({ id: `shadow-${index + 1}`, ...candidate }));
}
