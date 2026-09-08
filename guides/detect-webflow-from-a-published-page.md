# Detecting Webflow from a published page

A published Webflow site can be identified from a single page fetch, with no API access and no
credentials. The reliable evidence is not one marker but a set of them: attributes on the `<html>`
tag, an HTML comment Webflow's publisher writes, asset URLs on Webflow's CDN, `w-*` class names its
runtime depends on, and a handful of response headers. Any one of these can be copied, cached, or
proxied away by a third party, so a trustworthy verdict comes from scoring several of them together
and requiring at least one that is hard to fake.

This is how the `detect` phase in this repository gates a migration run: it scores 42 signals
against the home page and refuses to continue unless the result clears both a numeric threshold and
a structural condition.

## Which markers identify a Webflow page?

The strongest evidence sits on the `<html>` tag, where Webflow's publisher writes the site's own
identifiers:

| attribute            | value shape       | meaning                                    |
| -------------------- | ----------------- | ------------------------------------------ |
| `data-wf-page`       | 24 hex characters | page id                                    |
| `data-wf-site`       | 24 hex characters | site id                                    |
| `data-wf-domain`     | hostname          | the host the site was published to         |
| `data-wf-collection` | 24 hex characters | present only on a CMS collection template  |
| `data-wf-item-slug`  | slug              | present only on a CMS collection item page |

Next to those, five more kinds of evidence appear in the document itself:

- **The publisher's comment.** `<!-- Last Published: … GMT+0000 -->`. The fixed `GMT+0000` suffix is
  part of the pattern; Webflow writes publish timestamps in UTC.
- **Stylesheet and script URLs carrying the site id.** `website-files.com/<24hex>/css/*.min.css` and
  `website-files.com/<24hex>/js/`, plus the site-chunk marker `.schunk.<16hex>.js`, and jQuery
  served from `d3e54v103j8qbb.cloudfront.net/js/jquery-<version>.min.<hash>.js?site=<24hex>`.
- **The touch-detection script** Webflow inlines in `<head>`, recognisable by the pair `t=" w-mod-"`
  and `DocumentTouch` appearing together.
- **Runtime class names.** `w-nav`, `w-dyn-list` / `w-dyn-items` / `w-dyn-item`, `w--current`,
  `w-inline-block`, `w-richtext`, `w-embed`, `w-condition-invisible`, and the widget family
  (`w-form`, `w-input`, `w-button`, `w-dropdown`, `w-tabs`, `w-slider`, `w-lightbox`, `w-checkbox`,
  `w-container`, `w-clearfix`, `w-icon-*`, `w-layout-grid`).
- **Response headers.** Any `x-wf-*` header, an `x-lambda-id` holding a UUID, a `surrogate-key`
  containing both a 24-hex site id and `pageId:`, and `surrogate-control: max-age=432000`.

## How much evidence is enough?

Each signal carries a tier, and each tier a weight: `strong` = 3, `medium` = 2, `weak` = 1. The
registry holds 22 strong, 14 medium and 6 weak signals. A page needs a total of **6** to be called
Webflow.

Two rules keep that number honest.

**Families are capped.** Related signals are grouped, and a group contributes at most 6 regardless
of how many of its members hit. Two groups exist: `wf-w-classes` (9 signals) and `wf-assets` (4).
Without the cap, a page that merely copied Webflow's stylesheet would clear the threshold on class
names alone: all nine `w-*` signals hitting scores 21, more than three times what a verdict needs.
Capping the group at 6 forces corroboration from an unrelated kind of evidence.

**A weak-but-broad pile is not a verdict.** Clearing 6 is necessary but not sufficient: the run also
requires at least one strong signal marked as observable in the page's own HTML — nine signals carry
that flag — or the one `instant` signal, a host ending in `.webflow.io`, which alone satisfies the
threshold because a Webflow staging domain cannot be anything else. Headers, `robots.txt`, the
sitemap and the 404 page all contribute score, but none of them can carry a verdict by itself: a CDN
or a reverse proxy in front of a non-Webflow origin can produce header-shaped evidence.

Anything short of both conditions yields `unknown`, and the migration stops rather than guessing.

Some signals are deliberately conditional rather than absolute. Cloudflare's fingerprint
(`server: cloudflare`, `cf-ray`, a `_cfuvid` cookie) counts only when a Webflow-specific header is
present alongside it — on its own it identifies a CDN, not a platform. Similarly,
`cdn.prod.website-files.com` counts as strong evidence when the URL contains the same site id found
on the `<html>` tag, and otherwise only after five or more occurrences.

## Source in this repository

- [`src/scripts/detect/signals/webflow.ts`](../src/scripts/detect/signals/webflow.ts) — the signal
  registry, with the exact pattern behind each one
- [`src/scripts/detect/scoring.ts`](../src/scripts/detect/scoring.ts) — weights, family cap,
  threshold, verdict
- [`src/scripts/detect/hints.ts`](../src/scripts/detect/hints.ts) — extracting the site, page and
  domain identifiers

## Related

- [Reading a Webflow content model from a published site](read-webflow-content-model-from-published-site.md)
  — the next step once the verdict is `webflow`
- [Migration run metrics](migration-run-metrics.md) — detection cost and result on a real run

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
