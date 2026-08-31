import { buildFontFamilies } from "#assets/steps/fonts/build-font-families.ts";

describe("buildFontFamilies", () => {
  it("normalizes weight-named families into one family with merged weights", () => {
    const records = buildFontFamilies({
      faces: [{ family: "Inter" }, { family: "Inter Medium" }, { family: "Inter Bold" }],
      googleFamilies: [],
    });

    expect(records).toHaveLength(1);
    expect(records[0]?.family).toBe("Inter");
    expect(records[0]?.face.weights).toEqual(["400", "500", "700"]);
  });

  it("marks a custom @font-face family as downloaded with license risk", () => {
    const [record] = buildFontFamilies({
      faces: [
        {
          family: "DM Mono",
          weight: "300",
          srcUrl: "https://cdn.prod.website-files.com/site/DMMono-Light.woff2",
        },
      ],
      googleFamilies: [],
    });

    expect(record?.face.classification).toBe("custom");
    expect(record?.face.downloaded).toBe(true);
    expect(record?.face.licenseRisk).toBe(true);
    expect(record?.srcUrl).toBe("https://cdn.prod.website-files.com/site/DMMono-Light.woff2");
  });

  it("marks a google family as not downloaded and without a src url", () => {
    const [record] = buildFontFamilies({
      faces: [],
      googleFamilies: ["Montserrat:100,300,900"],
    });

    expect(record?.family).toBe("Montserrat");
    expect(record?.face.classification).toBe("google");
    expect(record?.face.downloaded).toBe(false);
    expect(record?.srcUrl).toBeUndefined();
  });
});
