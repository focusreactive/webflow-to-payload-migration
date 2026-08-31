import { loadHtml } from "#lib/html.ts";
import { rewriteCss, rewriteHtml } from "#replay/rewrite.ts";
import type { IdResolver } from "#replay/rewrite.ts";

const BASE = "https://site.example/";

function idForMap(entries: [string, string][]): IdResolver {
  const map = new Map(entries);
  return (url) => map.get(url);
}

describe("rewriteHtml", () => {
  it("rewrites src, href and poster to the asset route", () => {
    const idFor = idForMap([
      ["https://cdn.example/a.png", "IMG"],
      ["https://cdn.example/s.css", "CSS"],
      ["https://cdn.example/p.jpg", "POSTER"],
    ]);
    const html = rewriteHtml({
      html: `<img src="https://cdn.example/a.png"><link rel="stylesheet" href="https://cdn.example/s.css"><video poster="https://cdn.example/p.jpg"></video>`,
      baseUrl: BASE,
      idFor,
      fontsCss: "",
    });
    expect(html).toContain('src="/a/IMG"');
    expect(html).toContain('href="/a/CSS"');
    expect(html).toContain('poster="/a/POSTER"');
  });

  it("rewrites every url inside srcset while keeping the descriptors", () => {
    const idFor = idForMap([
      ["https://cdn.example/a.png", "IMGA"],
      ["https://cdn.example/b.png", "IMGB"],
    ]);
    const html = rewriteHtml({
      html: `<img srcset="https://cdn.example/a.png 1x, https://cdn.example/b.png 2x">`,
      baseUrl: BASE,
      idFor,
      fontsCss: "",
    });
    expect(html).toContain("/a/IMGA 1x");
    expect(html).toContain("/a/IMGB 2x");
    expect(html).not.toContain("cdn.example");
  });

  it("rewrites the comma-separated platform attributes read by javascript", () => {
    const idFor = idForMap([
      ["https://cdn.example/v.mp4", "VMP4"],
      ["https://cdn.example/v.webm", "VWEBM"],
      ["https://cdn.example/p.jpg", "PJPG"],
    ]);
    const html = rewriteHtml({
      html: `<div data-video-urls="https://cdn.example/v.mp4,https://cdn.example/v.webm" data-poster-url="https://cdn.example/p.jpg"></div>`,
      baseUrl: BASE,
      idFor,
      fontsCss: "",
    });
    expect(html).not.toContain("cdn.example");
    expect(html).toContain('data-video-urls="/a/VMP4,/a/VWEBM"');
    expect(html).toContain('data-poster-url="/a/PJPG"');
  });

  it("rewrites href only on <link>, leaving <a> navigation untouched", () => {
    const idFor = idForMap([["https://cdn.example/shared", "SHARED"]]);
    const html = rewriteHtml({
      html: `<a href="https://cdn.example/shared">go</a><link rel="stylesheet" href="https://cdn.example/shared">`,
      baseUrl: BASE,
      idFor,
      fontsCss: "",
    });
    expect(html).toContain('<a href="https://cdn.example/shared">go</a>');
    expect(html).toContain('<link rel="stylesheet" href="/a/SHARED">');
  });

  it("leaves an unknown url untouched so the blocked request is visible", () => {
    const idFor = idForMap([]);
    const html = rewriteHtml({
      html: `<img src="https://other.example/x.png">`,
      baseUrl: BASE,
      idFor,
      fontsCss: "",
    });
    expect(html).toContain("https://other.example/x.png");
  });

  // Subresource integrity is a hash of the bytes the CDN served. The replay
  // serves its own copy, and rewriteCss changes url() targets inside it, so the
  // hash can never still match — Chromium then drops the whole stylesheet and
  // the reference renders unstyled, which turns every pixel round into noise.
  it("drops integrity and crossorigin from an element whose url it rewrote", () => {
    const idFor = idForMap([["https://cdn.example/s.css", "CSS"]]);
    const html = rewriteHtml({
      html:
        `<link rel="stylesheet" href="https://cdn.example/s.css"`
        + ` integrity="sha384-abc" crossorigin="anonymous">`,
      baseUrl: BASE,
      idFor,
      fontsCss: "",
    });
    expect(html).toContain('href="/a/CSS"');
    expect(html).not.toContain("integrity");
    expect(html).not.toContain("crossorigin");
  });

  it("keeps integrity on an element it did not rewrite", () => {
    const idFor = idForMap([]);
    const html = rewriteHtml({
      html: `<script src="https://other.example/x.js" integrity="sha384-abc" crossorigin="anonymous"></script>`,
      baseUrl: BASE,
      idFor,
      fontsCss: "",
    });
    expect(html).toContain('integrity="sha384-abc"');
    expect(html).toContain('crossorigin="anonymous"');
  });

  it("drops integrity when it rewrote a srcset entry", () => {
    const idFor = idForMap([["https://cdn.example/a.png", "IMGA"]]);
    const html = rewriteHtml({
      html: `<img srcset="https://cdn.example/a.png 1x" integrity="sha384-abc">`,
      baseUrl: BASE,
      idFor,
      fontsCss: "",
    });
    expect(html).toContain("/a/IMGA 1x");
    expect(html).not.toContain("integrity");
  });

  it("appends the fonts style to head", () => {
    const idFor = idForMap([]);
    const html = rewriteHtml({
      html: `<html><head><title>t</title></head><body></body></html>`,
      baseUrl: BASE,
      idFor,
      fontsCss: "@font-face{}",
    });
    expect(html).toContain("@font-face{}");
  });
});

describe("rewriteCss", () => {
  it("rewrites url() targets and resolves relative ones against the sheet", () => {
    const idFor = idForMap([
      ["https://cdn.example/a.png", "CSSA"],
      ["https://cdn.example/styles/rel.png", "CSSREL"],
    ]);
    const css = rewriteCss({
      css: `a{background:url("https://cdn.example/a.png")} b{background:url(rel.png)}`,
      baseUrl: "https://cdn.example/styles/s.css",
      idFor,
    });
    expect(css).toContain("/a/CSSA");
    expect(css).toContain("/a/CSSREL");
  });

  it("leaves data urls alone", () => {
    const idFor = idForMap([]);
    const css = rewriteCss({ css: `a{background:url(data:image/png;base64,AAA)}`, baseUrl: BASE, idFor });
    expect(css).toContain("data:image/png;base64,AAA");
  });
});

describe("rewriteHtml anchor map", () => {
  const idFor: IdResolver = () => undefined;
  const PAGE = `<html><head><title>t</title></head><body><header></header><main></main></body></html>`;

  it("inlines the map into head, leaving the body indices it addresses untouched", () => {
    const html = rewriteHtml({
      html: PAGE,
      baseUrl: BASE,
      idFor,
      fontsCss: "",
      anchors: `{"mig-1":[0]}`,
    });

    const $ = loadHtml(html);
    const tag = $("head").find("script[data-mig-anchors]");
    expect(tag.attr("type")).toBe("application/json");
    expect(JSON.parse(tag.text())).toEqual({ "mig-1": [0] });
    expect($("body").children().length).toBe(2);
    expect($("body").children().first().is("header")).toBe(true);
  });

  it("escapes a markup-looking id so the data cannot close the tag", () => {
    const html = rewriteHtml({
      html: PAGE,
      baseUrl: BASE,
      idFor,
      fontsCss: "",
      anchors: `{"</script><b>boom</b>":[0]}`,
    });

    const $ = loadHtml(html);
    expect($("body").find("b").length).toBe(0);
    expect(JSON.parse($("script[data-mig-anchors]").text())).toEqual({ "</script><b>boom</b>": [0] });
  });

  it("omits the tag when the route has no map", () => {
    const html = rewriteHtml({ html: PAGE, baseUrl: BASE, idFor, fontsCss: "" });

    expect(html).not.toContain("data-mig-anchors");
  });
});
