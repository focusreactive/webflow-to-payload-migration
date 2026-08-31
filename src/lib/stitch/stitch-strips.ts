import { PNG } from "pngjs";

export interface StitchStrip {
  top: number;
  buffer: Buffer;
}

export function stitchStrips(opts: {
  strips: StitchStrip[];
  documentHeight: number;
  viewportWidth: number;
  dpr: number;
}): Buffer {
  const { strips, documentHeight, viewportWidth, dpr } = opts;
  const canvasWidth = Math.round(viewportWidth * dpr);
  const canvasHeight = Math.round(documentHeight * dpr);
  const canvas = new PNG({ width: canvasWidth, height: canvasHeight });

  const ordered = [...strips].sort((a, b) => a.top - b.top);
  ordered.forEach((strip, index) => {
    const destStart = Math.round(strip.top * dpr);
    const nextTop = ordered[index + 1]?.top ?? documentHeight;
    const destEnd = index < ordered.length - 1 ? Math.round(nextTop * dpr) : canvasHeight;
    const rows = Math.min(destEnd, canvasHeight) - destStart;
    if (rows <= 0) return;

    const source = PNG.sync.read(strip.buffer);
    PNG.bitblt(source, canvas, 0, 0, Math.min(canvasWidth, source.width), Math.min(rows, source.height), 0, destStart);
  });

  return PNG.sync.write(canvas);
}
