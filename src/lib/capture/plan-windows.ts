export interface WindowPlan {
  windowIndex: number;
  top: number;
  height: number;
}

export function planWindows(opts: {
  documentHeight: number;
  viewportHeight: number;
  overlapFraction: number;
}): WindowPlan[] {
  const { documentHeight, viewportHeight, overlapFraction } = opts;
  if (documentHeight <= viewportHeight) {
    return [{ windowIndex: 0, top: 0, height: documentHeight }];
  }

  const stride = Math.max(1, Math.round(viewportHeight * (1 - overlapFraction)));
  const count = Math.ceil((documentHeight - viewportHeight) / stride) + 1;

  return Array.from({ length: count }, (_, windowIndex) => ({
    windowIndex,
    top: Math.min(windowIndex * stride, documentHeight - viewportHeight),
    height: viewportHeight,
  }));
}
