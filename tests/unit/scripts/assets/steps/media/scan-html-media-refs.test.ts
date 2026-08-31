import { scanHtmlMediaRefs } from "#assets/steps/media/scan-html-media-refs.ts";

const BASE = "https://site.example/page";

describe("scanHtmlMediaRefs", () => {
  it("collects img src, every srcset candidate, and propagates alt", () => {
    const html = `<img src="/a.jpg" srcset="/a-p-500.jpg 500w, /a-p-800.jpg 800w" alt="Hero shot">`;
    const refs = scanHtmlMediaRefs(html, BASE);

    expect(refs).toContainEqual({
      rawUrl: "https://site.example/a.jpg",
      source: "img-src",
      hint: "image",
      alt: "Hero shot",
    });
    expect(refs).toContainEqual({
      rawUrl: "https://site.example/a-p-500.jpg",
      source: "img-srcset",
      hint: "image",
      alt: "Hero shot",
    });
    expect(refs).toContainEqual({
      rawUrl: "https://site.example/a-p-800.jpg",
      source: "img-srcset",
      hint: "image",
      alt: "Hero shot",
    });
  });

  it("extracts lightbox image urls from a w-json script", () => {
    const html = `<script class="w-json" type="application/json">{"items":[{"url":"https://cdn.example/x_unsplash.jpg","type":"image"}],"group":"Archive Image"}</script>`;
    const refs = scanHtmlMediaRefs(html, BASE);

    expect(refs).toContainEqual({
      rawUrl: "https://cdn.example/x_unsplash.jpg",
      source: "lightbox-json",
      hint: "image",
    });
  });

  it("extracts background-video urls and the poster", () => {
    const html = `<div data-video-urls="https://cdn.example/v.mp4,https://cdn.example/v.webm" data-poster-url="https://cdn.example/poster.jpg"></div>`;
    const refs = scanHtmlMediaRefs(html, BASE);

    expect(refs).toContainEqual({
      rawUrl: "https://cdn.example/v.mp4",
      source: "video-urls",
      hint: "video",
    });
    expect(refs).toContainEqual({
      rawUrl: "https://cdn.example/v.webm",
      source: "video-urls",
      hint: "video",
    });
    expect(refs).toContainEqual({
      rawUrl: "https://cdn.example/poster.jpg",
      source: "poster-url",
      hint: "image",
    });
  });

  it("extracts inline background-image urls", () => {
    const html = `<div style="background-image:url('/bg.png')"></div>`;
    const refs = scanHtmlMediaRefs(html, BASE);

    expect(refs).toContainEqual({
      rawUrl: "https://site.example/bg.png",
      source: "background-image",
      hint: "image",
    });
  });

  it("extracts og:image and twitter:image meta tags", () => {
    const html = `<meta property="og:image" content="/og.jpg"><meta name="twitter:image" content="/tw.jpg">`;
    const refs = scanHtmlMediaRefs(html, BASE);

    expect(refs).toContainEqual({
      rawUrl: "https://site.example/og.jpg",
      source: "og-image",
      hint: "image",
    });
    expect(refs).toContainEqual({
      rawUrl: "https://site.example/tw.jpg",
      source: "og-image",
      hint: "image",
    });
  });
});
