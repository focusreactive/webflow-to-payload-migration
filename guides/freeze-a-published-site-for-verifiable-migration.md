# Freezing a published site so the migration is verifiable

Rebuilding a visual-builder site as components is only half the work; the other half is being able to
prove the rebuild matches. Screenshots cannot do that — they show that something looks roughly
right, and they cannot tell you that a heading is 46px rather than 48px, or that a gap collapsed from
32px to 24px. So the reference has to be frozen as **numbers keyed to identified elements**, captured
once, before any rebuilding starts. Everything downstream then compares against that frozen copy
rather than against a live site that changes under it.

## What gets frozen for each page?

Three files per route, plus a screenshot:

| file                  | what it holds                                              |
| --------------------- | ---------------------------------------------------------- |
| `index.html`          | the raw HTML exactly as the server returned it             |
| `index.rendered.html` | the DOM after hydration and scripts have run               |
| `index.styles.json`   | curated computed style properties, keyed by element anchor |
| `desktop.png`         | a full-page screenshot, stitched from viewport strips      |

Both HTML forms are needed because they answer different questions. The raw HTML is what the
platform published — it carries the platform's own markers and its server-rendered content. The
hydrated DOM is what a visitor actually sees, including anything the runtime injected or rearranged.
A rebuild has to match the second while a content model has to be inferred from the first.

Alongside the screenshot, a per-route record keeps the URL, the capture timestamp, the document's
full height, the device pixel ratio, and a rect for every anchored element.

## How do you address an element across two different DOMs?

By minting an anchor id. During capture every mapped element is given a `data-mig-id` — `mig-0`,
`mig-1`, and so on — and that id becomes the key in the style file and in the rect map. Selectors
would not survive the trip: the rebuilt component has different class names, different nesting, and
different element counts, so a CSS selector that identifies a node on the reference identifies
nothing on the candidate. An anchor id is stable by construction because it is assigned once and
recorded.

To read the reference later, a local replay server serves the frozen page back with the anchor map
inlined and a small script that stamps the ids on load. It also exposes `window.__migStamped` as
`{ total, stamped, missing }`. Checking that `missing` is empty is the cheap way to catch a stale
anchor map — you find out before comparing, not after drawing wrong conclusions from a comparison
against a node that no longer exists.

## Which properties are worth recording?

- **Box and position** — `display`, `position`, the four offsets, `width`, `height`, all four
  margins, all four paddings
- **Layout** — `flex-direction`, `justify-content`, `align-items`, `gap`,
  `grid-template-columns`, `overflow`, `z-index`, `object-fit`
- **Type** — `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`,
  `text-align`, `text-transform`, `font-style`, `text-decoration`, `list-style-type`, `color`
- **Surface** — `background-color`, `background-image`, `opacity`, `border-width`, `border-style`,
  `border-color`, `border-top-left-radius`, `box-shadow`

## What has to be neutralised before capturing?

A live page is not a still image, and four things will otherwise make the capture unrepeatable:

- **Lazy loading.** A pre-scroll pass walks the page in steps, pausing 100ms per step, up to 100
  steps, then jumps to the bottom. Without it, everything below the fold captures as a placeholder.
- **Animation.** A style block zeroes every transition duration and delay, and infinitely repeating
  animations are paused and rewound to their start, so a spinner or a marquee is captured at a
  defined position instead of wherever it happened to be.
- **Instability.** Capture waits for the page to stop changing — a settle budget of 6000ms, a
  network-idle timeout of 5000ms, and a requirement of five consecutive stable frames — rather than
  sleeping a fixed interval and hoping.
- **Sticky elements.** A sticky header would otherwise repeat down a stitched screenshot once per
  strip. Each sticky region is assigned to the strip that owns it and hidden in all the others, so it
  appears exactly once, and its anchor id and rect are recorded separately.

Full-page screenshots are stitched from viewport-height strips with a 12.5% overlap between
consecutive strips, which gives the stitcher enough common pixels to align on.

## Source in this repository

- [`src/lib/capture/defaults.ts`](../src/lib/capture/defaults.ts) — the viewport and settle budget
- [`src/lib/capture/page-scripts.ts`](../src/lib/capture/page-scripts.ts) — pre-scroll and animation
  freezing
- [`src/scripts/snapshot/constants/capture.ts`](../src/scripts/snapshot/constants/capture.ts) —
  overlap fraction, stability thresholds, sticky hiding
- [`src/scripts/snapshot/constants/style-properties.ts`](../src/scripts/snapshot/constants/style-properties.ts)
  — the 43 curated properties
- [`src/ir/stitch.ts`](../src/ir/stitch.ts) — the per-route capture record

## Related

- [Webflow sections to Payload blocks](webflow-sections-to-payload-blocks.md) — what is built against
  the frozen reference
- [Migration run metrics](migration-run-metrics.md) — what capture costs on a real run

---

## 🚀 Need Help with Headless CMS Migration?

This repository is maintained by [FocusReactive](https://focusreactive.com) — a specialized Next.js and Headless CMS migration agency.

We help enterprise businesses migrate from legacy monoliths (WordPress, Drupal, Sitecore) and visual builders (Webflow, Framer) to modern stacks like Sanity, Payload CMS, Storyblok, and MedusaJS.

The pipeline in this repository is one path out of that matrix, published in full. The internal version of the same tooling covers the others — if your migration path isn't Webflow → Payload, ask us about it.

### Why FocusReactive?

- **Expertise:** Verified Sanity, Payload, and Storyblok partners.
- **Speed:** We use our proprietary [CMS Kit](https://github.com/focusreactive/cms-kit) to speed up migrations by 40%.
- **SEO & Performance:** Zero downtime migrations with 100/100 Lighthouse scores.

👉 **[Get a Free Migration Consultation](https://focusreactive.com/services/headless-cms-expert-agency/)** or contact us at contact@focusreactive.com.
