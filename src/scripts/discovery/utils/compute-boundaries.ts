import type { StitchIndexData } from "#ir/stitch.ts";

import type { Rect } from "../types.ts";

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

export function computeBoundaries(
  nodeIds: string[],
  elements: StitchIndexData["elements"],
): Record<string, { rect: Rect }> {
  const perViewport: Record<string, Rect> = {};
  for (const nodeId of nodeIds) {
    const byViewport = elements[nodeId];
    if (!byViewport) continue;
    for (const [viewport, entry] of Object.entries(byViewport)) {
      const existing = perViewport[viewport];
      perViewport[viewport] = existing ? union(existing, entry.rect) : entry.rect;
    }
  }
  const boundaries: Record<string, { rect: Rect }> = {};
  for (const [viewport, rect] of Object.entries(perViewport)) boundaries[viewport] = { rect };
  return boundaries;
}
