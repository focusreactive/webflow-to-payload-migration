# Reading a Webflow content model from a published site

A published Webflow site tells you which of its pages are CMS collection items, which collection
each belongs to, and what each item's slug is — all from attributes on the `<html>` tag.

## How do you tell a collection item page from a static page?

Both carry `data-wf-page` and `data-wf-site` on `<html>`. Only a page rendered from a CMS collection
template also carries:

- `data-wf-collection="<24 hex>"` — the id of the collection it belongs to
- `data-wf-item-slug="<slug>"` — the item's own slug

So the test is a single attribute check: `data-wf-collection` present means an item page,
absent means a static page. Collection lists embedded in a static page do not change that page's
kind; they only mark it as a page that reads from a collection.

## How do you find every page?

Two seed sources, then breadth-first expansion:

1. **The sitemap.** `sitemap.xml` is parsed; if the root is a `<sitemapindex>` rather than a
   `<urlset>`, each child sitemap is fetched and its `<urlset>` entries collected. Non-urlset
   children are skipped, and a child that fails to fetch is a warning, not a failure.
2. **The entry URL** you were given.

## How do collections fall out of that?

Group the item pages by their `data-wf-collection` value. Each group yields one collection:

- **key** — the 24-hex collection id
- **route pattern** — the directory of any item's route plus `/:slug`
- **item count** — how many item pages the crawl found

One cross-check is worth running: a page id should map to exactly one collection id, because a CMS
template renders one collection. If the same `data-wf-page` shows up with two different collection
ids, something about the site does not match that assumption, and it is worth a warning rather than
a silent merge.

## Source in this repository

- [`src/adapters/webflow/classify.ts`](../src/adapters/webflow/classify.ts) — the item-versus-static
  test
- [`src/adapters/webflow/crawl.ts`](../src/adapters/webflow/crawl.ts) — the crawl, its warnings, and
  the page-id cross-check
- [`src/adapters/shared/pages.ts`](../src/adapters/shared/pages.ts) — grouping routes into
  collections
- [`src/adapters/shared/sitemap-collect.ts`](../src/adapters/shared/sitemap-collect.ts) — sitemap and
  sitemap-index handling

## Related

- [Detecting Webflow from a published page](detect-webflow-from-a-published-page.md) — the check that
  runs before this
- [Webflow sections to Payload blocks](webflow-sections-to-payload-blocks.md) — where these
  collections and routes end up
- [Migration run metrics](migration-run-metrics.md) — the numbers above, in context
