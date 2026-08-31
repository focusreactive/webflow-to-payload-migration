# Inventory phase

Crawling the site into the page/collection list every later stage indexes by:
static routes from the sitemap plus Webflow's item template routes, classified
and deduped. One script, one step (`inventory`).

## Step 1 · inventory (script, manifest step `inventory`)

```
pnpm tsx src/scripts/inventory/index.ts --project <projectPath> [--force]
```

Report the page and collection counts.

```json
{
   "step": "inventory",
   "status": "done" | "skipped",
   "pages": <n>,
   "collections": <n>
}
```

Deterministic work, in order:

1. Read `probe`'s sitemap and `detect`'s platform hints (both already on disk).
2. Collect every sitemap URL, following nested sitemaps through the snapshot
   store (no re-fetching what `probe` already captured).
3. Crawl from the source URL plus every sitemap URL, following in-origin links.
   A site with no sitemap is therefore still covered — the crawl reaches it
   through links. Each page is classified as a static page or a collection-item
   route, and the item-template collections are derived from
   `data-wf-collection` plus the sitemap patterns.
4. Write `pages.json` (`{ pages: [...], collections: [...] }`) and record it
   against the `inventory` step.

The whole origin is crawled: there is no route allow-list, and the only ceiling
is `MAX_PAGES` from `src/lib/crawl-defaults.ts`.
