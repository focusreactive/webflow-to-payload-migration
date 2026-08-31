import { parseWebFontLoad } from "#assets/parse-web-font-load.ts";

describe("parseWebFontLoad", () => {
  it("extracts google families from a WebFont.load call", () => {
    const html = `<script>WebFont.load({google:{families:["Montserrat:100,300,900italic","Inter:400,700"]}});</script>`;

    expect(parseWebFontLoad(html)).toEqual(["Montserrat:100,300,900italic", "Inter:400,700"]);
  });

  it("returns an empty array when WebFont.load is absent", () => {
    expect(parseWebFontLoad("<script>console.log(1)</script>")).toEqual([]);
  });
});
