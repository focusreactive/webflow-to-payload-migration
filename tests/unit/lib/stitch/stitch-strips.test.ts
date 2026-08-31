import { PNG } from "pngjs";

import { stitchStrips } from "#lib/stitch/stitch-strips.ts";

function solidStrip(width: number, height: number, rgb: [number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = rgb[0];
    png.data[i + 1] = rgb[1];
    png.data[i + 2] = rgb[2];
    png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

function rowColor(png: PNG, y: number): [number, number, number] {
  const idx = (png.width * y + 0) * 4;
  return [png.data[idx] ?? 0, png.data[idx + 1] ?? 0, png.data[idx + 2] ?? 0];
}

describe("stitchStrips", () => {
  it("composes non-overlapping doc bands from ordered strips at dpr 1", () => {
    const stitched = stitchStrips({
      strips: [
        { top: 0, buffer: solidStrip(50, 200, [255, 0, 0]) },
        { top: 100, buffer: solidStrip(50, 200, [0, 0, 255]) },
      ],
      documentHeight: 300,
      viewportWidth: 50,
      dpr: 1,
    });
    const png = PNG.sync.read(stitched);
    expect([png.width, png.height]).toEqual([50, 300]);
    expect(rowColor(png, 50)).toEqual([255, 0, 0]);
    expect(rowColor(png, 250)).toEqual([0, 0, 255]);
  });

  it("scales the canvas by dpr and crops a short single strip to document height", () => {
    const stitched = stitchStrips({
      strips: [{ top: 0, buffer: solidStrip(20, 30, [10, 20, 30]) }],
      documentHeight: 15,
      viewportWidth: 10,
      dpr: 2,
    });
    const png = PNG.sync.read(stitched);
    expect([png.width, png.height]).toEqual([20, 30]);
  });
});
