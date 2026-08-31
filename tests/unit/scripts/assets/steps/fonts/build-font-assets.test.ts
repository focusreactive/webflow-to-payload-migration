import { buildFontAssets } from "#assets/steps/fonts/build-font-assets.ts";
import type { FontAssetsData } from "#ir/assets.ts";

import { cdn, makeFakeStore, SITE, type FakeStoreConfig } from "../../fixtures/assets.ts";

async function build(config: FakeStoreConfig): Promise<FontAssetsData> {
  return buildFontAssets(makeFakeStore(config));
}

describe("buildFontAssets", () => {
  it("records a custom @font-face as a downloaded font with license risk", async () => {
    const fontUrl = cdn(`/${SITE}/DMMono-Light.woff2`);
    const css = `@font-face { font-family: 'DM Mono'; src: url("${fontUrl}") format("woff2"); font-weight: 300 }`;
    const data = await build({
      pages: [{ url: "https://site.example/", html: "<div></div>" }],
      styles: [{ url: "https://site.example/css/main.css", css }],
      assets: { [fontUrl]: { bytes: Buffer.from("woff2"), contentType: "font/woff2" } },
    });

    const font = data.assets.find((a) => a.kind === "font");
    expect(font?.font?.family).toBe("DM Mono");
    expect(font?.font?.classification).toBe("custom");
    expect(font?.font?.licenseRisk).toBe(true);
    expect(font?.status).toBe("downloaded");
    expect(font?.sources).toEqual(["font-face"]);
  });

  it("records a google font from WebFont.load as not downloaded", async () => {
    const html = `<script>WebFont.load({google:{families:["Montserrat:400,700"]}})</script>`;
    const data = await build({
      pages: [{ url: "https://site.example/", html }],
    });

    const font = data.assets.find((a) => a.kind === "font");
    expect(font?.font?.family).toBe("Montserrat");
    expect(font?.font?.classification).toBe("google");
    expect(font?.font?.downloaded).toBe(false);
    expect(font?.storePath).toBeUndefined();
    expect(font?.sources).toEqual(["webfont-load"]);
  });
});
