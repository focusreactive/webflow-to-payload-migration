# Snapshot phase

Freezing the published site: every route from `pages.json` is fetched, rendered in
Chromium, measured, photographed and mirrored to disk, together with every
stylesheet, script, JSON payload and font it needs. Everything downstream —
tokens, discovery, the synth verticals, layout, generate — reads this
frozen copy and never the live site again.

**Prerequisite — Chromium.** The step launches Chromium through Playwright.
Before the first live snapshot in an environment run
`pnpm exec playwright install chromium`. A browser-launch failure means this is
missing; install it and re-run.

## Step 1 · snapshot (script, manifest step `snapshot`)

```
pnpm tsx src/scripts/snapshot/index.ts --project <projectPath> [--force]
```

```json
{ "step": "snapshot", "status": "done" }
```

Work, in this order:

1. **Pages.** Every `pages.json` route is fetched as `<origin><route>` through
   the snapshot store, which mirrors it to
   `.migration/snapshot/pages/<route>/index.html` and records the entry in
   `.migration/snapshot/index.json`. Stylesheet, modulepreload and preload
   links plus `<script src>` are collected from each body as its static
   dependencies.
2. **Render pass.** For each page Chromium loads the URL, settles it
   (`SETTLE_MS` from `src/lib/capture/defaults.ts`, then network-idle, fonts, finite
   animations and a pre-scroll to trigger lazy content), stamps every element
   with `data-mig-id`, and records the curated computed properties plus the
   element rectangle. Output per page, next to the raw mirror:
   `index.rendered.html` (post-JS DOM) and `index.styles.json` (the curated
   props keyed by `data-mig-id`); both paths are attached to the page's store
   entry. The remaining viewports are re-measured for rectangles only — those
   rectangles reach disk through the stitch index, not the styles sidecar.
3. **Stitch captures.** Each viewport is photographed as overlapping windows and
   stitched into one full-page PNG under
   `.migration/artifacts/stitch/<route>/<viewport>.png`, next to a validated
   `index.json` holding the document size, dpr, pixel size, sticky regions and
   the per-element rectangles. Motion is frozen, sticky/fixed elements are shown
   once and hidden in every other window, so the stitch has no repeated headers.
   A route whose `index.json` already exists is left alone unless `--force`.
4. **Dependencies.** Static and runtime-observed URLs are unioned, filtered to
   `.css` / `.js` / `.mjs` / `.json` and downloaded into
   `.migration/snapshot/{styles,scripts,data}/`. A failing dependency is logged
   and skipped — it never fails the step.
5. **Fonts.** `@font-face` rules from the page bodies, the mirrored stylesheets
   and the provider stylesheets (Google Fonts, Typekit, Bunny, Fontshare) are
   collected, the binaries downloaded to `.migration/snapshot/assets/fonts/`,
   and `.migration/snapshot/styles/fonts.css` is emitted pointing at them.

**Repeating is safe.** On a project where the step is already `done` the script
prints `{"step":"snapshot","status":"skipped"}`, writes nothing, never launches
Chromium and exits 0 — continue to the next phase. `--force` re-renders every
page and rewrites the stitches, which you want only when the source site itself
has changed.

**A partially failed run resumes with `--refresh`, not with a plain re-run.**
Stitches are guarded per route (already-captured routes are skipped) while
rendered DOM and styles are rewritten every run, so a plain resume re-renders
completed routes while keeping their earlier stitches — and the two drift apart
if a render is not bit-identical. Step 2 clears both so they stay consistent.

## Step 2 · refresh (script, not a manifest step — only on explicit request)

```
pnpm tsx src/scripts/snapshot/index.ts --project <projectPath> --refresh
```

```json
{ "step": "snapshot", "status": "refreshed" }
```

**Warn the user first: this breaks the freeze.** Anything built on the old
DOM, styles or stitches will no longer match the mirror.

It drops every snapshot entry except `probe`'s (whose files stay on disk for
`detect`), deletes the mirrored `pages/`, `styles/`, `scripts/`, `data/` and
`assets/` directories and the whole `.migration/artifacts/stitch/` tree, then
clears the manifest steps that were built on them — `assets:*`, `tokens:*`,
`discovery*`, `synth:collections*`, `synth:globals*`, `synth:blocks*`,
`layout*`, `generate:*` — and puts `inventory` and `snapshot` back to `pending`.
The next continue re-crawls, then re-renders from scratch, and every cleared
stage has to be re-run afterwards.

## Verify

Read `<projectPath>/.migration/manifest.json`: `steps["snapshot"].status` is
`"done"`.

Read `<projectPath>/.migration/snapshot/index.json`: every route in
`pages.json` has an entry keyed by its absolute URL with `kind: "page"` and
both `paths.rendered` and `paths.styles` set. Entries with `kind` `style` /
`script` / `data` / `asset` are the downloaded dependencies and font binaries.

On disk under `<projectPath>/.migration/snapshot/`:

| path                                | holds                                           |
| ----------------------------------- | ----------------------------------------------- |
| `pages/<route>/index.html`          | the raw page body as served                     |
| `pages/<route>/index.rendered.html` | the post-JS DOM, `data-mig-id` on every element |
| `pages/<route>/index.styles.json`   | `data-mig-id` → curated computed styles         |
| `styles/`, `scripts/`, `data/`      | mirrored dependencies                           |
| `assets/fonts/`                     | font binaries                                   |
| `styles/fonts.css`                  | `@font-face` rules pointing at those binaries   |
| `probe/`                            | untouched, written by the probe phase           |

And under `<projectPath>/.migration/artifacts/stitch/<route>/`: one
`<viewport>.png` per configured viewport plus `index.json`.

A missing `index.rendered.html` or `index.styles.json` for a route is what makes
discovery and layout fail later; a missing `fonts.css` is what the synth
preflight refuses to start on.
