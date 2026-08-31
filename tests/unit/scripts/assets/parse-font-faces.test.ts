import { parseFontFaces } from "#assets/parse-font-faces.ts";

describe("parseFontFaces", () => {
  it("extracts family, weight, style and the woff2 src url", () => {
    const css = `@font-face {
      font-family: 'DM Mono';
      src: url("https://cdn.prod.website-files.com/site/DMMono-Light.woff2") format("woff2");
      font-weight: 300;
      font-style: normal;
    }`;
    const faces = parseFontFaces(css);

    expect(faces).toEqual([
      {
        family: "DM Mono",
        weight: "300",
        style: "normal",
        srcUrl: "https://cdn.prod.website-files.com/site/DMMono-Light.woff2",
      },
    ]);
  });

  it("returns an empty array when there is no @font-face", () => {
    expect(parseFontFaces(".a { color: red }")).toEqual([]);
  });
});
