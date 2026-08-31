import { PNG } from "pngjs";

import { downscalePng } from "#discovery/utils/downscale-png.ts";

function solid(width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  png.data.fill(200);
  return PNG.sync.write(png);
}

describe("downscalePng", () => {
  it("scales the long side down to the cap and preserves aspect ratio", () => {
    const out = PNG.sync.read(downscalePng(solid(2000, 1000), 500));
    expect(out.width).toBe(500);
    expect(out.height).toBe(250);
  });

  it("leaves an image below the cap untouched", () => {
    const out = PNG.sync.read(downscalePng(solid(100, 40), 500));
    expect(out.width).toBe(100);
    expect(out.height).toBe(40);
  });
});
