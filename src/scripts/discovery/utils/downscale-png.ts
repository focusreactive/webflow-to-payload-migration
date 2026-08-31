import { PNG } from "pngjs";

export function downscalePng(buffer: Buffer, maxLongSide: number): Buffer {
  const src = PNG.sync.read(buffer);
  const longSide = Math.max(src.width, src.height);
  if (longSide <= maxLongSide) return PNG.sync.write(src);

  const scale = maxLongSide / longSide;
  const width = Math.max(1, Math.round(src.width * scale));
  const height = Math.max(1, Math.round(src.height * scale));
  const dst = new PNG({ width, height });

  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(src.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor(x / scale));
      const s = (src.width * sy + sx) * 4;
      const d = (width * y + x) * 4;
      dst.data[d] = src.data[s] ?? 0;
      dst.data[d + 1] = src.data[s + 1] ?? 0;
      dst.data[d + 2] = src.data[s + 2] ?? 0;
      dst.data[d + 3] = src.data[s + 3] ?? 255;
    }
  }
  return PNG.sync.write(dst);
}
