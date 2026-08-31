import { mintBlockTypeId } from "#ir/block-type-id.ts";
import { type BlockTypeId } from "#ir/common.ts";

const ids = (...xs: string[]) => xs as unknown as BlockTypeId[];

describe("mintBlockTypeId", () => {
  it("slugifies the role", () => {
    expect(mintBlockTypeId("Feature Grid", ids())).toBe("feature-grid");
  });

  it("disambiguates collisions with a numeric suffix", () => {
    expect(mintBlockTypeId("Hero", ids("hero"))).toBe("hero-2");
    expect(mintBlockTypeId("Hero", ids("hero", "hero-2"))).toBe("hero-3");
  });

  it("strips diacritics and non-alphanumerics", () => {
    expect(mintBlockTypeId("Café — CTA!", ids())).toBe("cafe-cta");
  });

  it("falls back to 'block' for an empty slug", () => {
    expect(mintBlockTypeId("—", ids())).toBe("block");
  });
});
