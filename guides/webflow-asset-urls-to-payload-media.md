# Webflow asset URLs to Payload media

The same image on a Webflow site appears under many URLs: on four different CDN hostnames, with
cache-busting query strings, and in up to seven generated width variants. Copying those URLs into a
Payload `media` collection one-for-one produces a library where a single photograph occupies a dozen
entries. Collapsing them correctly takes three separate steps — canonicalising the URL, discarding
generated variants, and de-duplicating by content hash — because each catches duplicates the others
cannot see.

## Which hostnames serve the same asset?

Four hosts serve Webflow asset paths, and they are interchangeable for a given path:

- `cdn.prod.website-files.com` — the current one, used as canonical
- `assets.website-files.com`
- `assets-global.website-files.com`
- `uploads-ssl.webflow.com`

Canonicalising means rewriting any of the aliases to `cdn.prod.website-files.com` and **dropping the
query string entirely**, since it only ever carries cache-busting parameters. One more fix applies
to every URL regardless of host: `%2f` sequences in the path are decoded back to `/`, because they
appear inconsistently and would otherwise split one asset into two.

## Which URLs are generated variants rather than assets?

Webflow generates responsive copies of an uploaded image and names them by appending `-p-<width>`
before the extension:

```
6098…_photo.jpg          ← the original
6098…_photo-p-500.jpeg   ← generated
6098…_photo-p-1600.jpeg  ← generated
```

The widths are drawn from a fixed set: **500, 800, 1080, 1600, 2000, 2600, 3200**. Matching the
`-p-<number>` suffix alone is not enough — a file legitimately named `chart-p-42.png` would be
mistaken for a variant — so the number has to be checked against that set.

Variant references are skipped before anything is fetched. Only the original is downloaded, and any
later reference to a variant URL resolves to the original's id by stripping the suffix. Practically,
this means a `srcset` of seven URLs contributes exactly one media document.

## Where do asset references hide?

Scanning `<img src>` is not sufficient. References are collected from eight places, and the record
keeps the list of which ones a given asset was found in:

`img-src`, `img-srcset`, `background-image`, `css-url`, `lightbox-json`, `video-urls`, `poster-url`,
`og-image`.

Two of these are easy to miss and commonly matter. `css-url` covers `url(…)` inside the site's
stylesheet, where Webflow puts background images set in the Designer. `lightbox-json` covers the
JSON payload Webflow embeds for `w-lightbox` galleries, whose full-size images appear nowhere in the
markup.

Alt text is collected per reference and the most frequent non-empty value wins, since the same image
is often given different alt text on different pages.

## What survives into Payload?

One media document per canonical URL, holding the downloaded bytes, the content type and size
reported by the CDN, the SHA-256 of the content, the original file name, and Webflow's asset id when
one was present. Fields on other documents point at that document's id.

After download, a third de-duplication pass runs: records whose content hashes are identical are
collapsed by marking the later ones as aliases of the first. This catches the case the URL rules
cannot — the same file uploaded twice, under two unrelated names, which no amount of URL
normalisation would reveal as one asset.

## Source in this repository

- [`src/adapters/webflow/media-normalize.ts`](../src/adapters/webflow/media-normalize.ts) — host
  aliases, variant widths, the 24-hex prefix
- [`src/scripts/assets/steps/media/utils/build-media-assets.ts`](../src/scripts/assets/steps/media/utils/build-media-assets.ts)
  — grouping, download, content de-duplication
- [`src/ir/assets.ts`](../src/ir/assets.ts) — the asset record and the list of reference sources

## Related

- [Webflow sections to Payload blocks](webflow-sections-to-payload-blocks.md) — how fields point at
  media documents
- [Migration run metrics](migration-run-metrics.md) — the asset numbers above, in context
