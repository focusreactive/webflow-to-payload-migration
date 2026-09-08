# webflow-to-payload-migration

Migrate a published Webflow site into a Payload CMS project.

> **This repository is the public slice of [FocusReactive's](https://focusreactive.com) internal migration tooling, and it is cut down in two ways.** It covers one path only — Webflow → Payload — and the pipeline behind that path is itself a simplified, but not hollowed out version of the internal one, though — it runs end-to-end on its own and hands you a working project.

## What you get

A standalone Payload 3 + Next 15 project on SQLite, generated from the live site:

- **Collections** for every Webflow CMS collection, with their fields typed and their items seeded
- **Section blocks** as real React components, registered as Payload blocks and composable in the
  admin
- **Global header and footer** as Payload globals, rendered by the app shell
- **Design tokens** — colours, type scale, spacing, radii, shadows — as CSS variables
- **Images and videos** uploaded into Payload's media collection, referenced by the content that
  uses them
- **Webfonts** copied into the project and served from it
- **A seed** that fills the database from the migration's own artifacts, so the project has content
  the first time you open it

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
```

## Usage

Launch Claude Code and call migration skill:

```
/migrate https://your-site.webflow.io/
```

The migration runs in a workspace beside this repository (`../migrations/<project-name>` by
default, set in `migrate.config.json`); this repository is never written to by a run.

## How it works

Ten phases, in execution order:

| phase           | what it does                                                                   |
| --------------- | ------------------------------------------------------------------------------ |
| `probe`         | fetches the home page, `robots.txt`, the sitemap and a 404 page                |
| `detect`        | scores the home page against the Webflow signal registry and gates the run     |
| `inventory`     | crawls the site into its page list and its CMS collections                     |
| `snapshot`      | freezes every page: raw HTML, post-hydration DOM, computed styles, screenshots |
| `assets`        | inventories every image, video and font family behind a stable asset id        |
| `design-tokens` | reads the frozen styles into a token set and emits the theme                   |
| `discovery`     | names the page's blocks, the site's globals and its collections                |
| `synth`         | authors each surface: field schema, content, and a React component             |
| `layout`        | composes each route from block instances with their field values               |
| `generate`      | writes the Payload + Next project, then installs, seeds, builds and lints it   |

Run state lives in the project's `.migration/` directory: `manifest.json` records every step and
its status, and `artifacts/` holds the intermediate representation each phase reads and writes.
Every step is idempotent and every run is resumable — point the skill at an existing project and it
picks up at the first step that is not `done`.

## Guides

| guide                                                                                                                  | answers                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [Detecting Webflow from a published page](guides/detect-webflow-from-a-published-page.md)                              | How do you tell that a site is built with Webflow, and how confident can you be?                                    |
| [Reading a Webflow content model from a published site](guides/read-webflow-content-model-from-published-site.md)      | Which pages are CMS items, which collection does each belong to, and how do you find them all without an API token? |
| [Webflow asset URLs to Payload media](guides/webflow-asset-urls-to-payload-media.md)                                   | Which of these CDN URLs are the same image, and which one is the original?                                          |
| [Freezing a published site so the migration is verifiable](guides/freeze-a-published-site-for-verifiable-migration.md) | How do you prove a rebuilt page matches the original, when screenshots cannot?                                      |
| [Webflow sections to Payload blocks](guides/webflow-sections-to-payload-blocks.md)                                     | Webflow has no block model — so where does the Payload one come from?                                               |

## Demo

|                     |                                                                   |
| ------------------- | ----------------------------------------------------------------- |
| Reference (Webflow) | [rythm-path-five.webflow.io](https://rythm-path-five.webflow.io/) |
| Migrated (Payload)  | [rythm-chi.vercel.app](https://rythm-chi.vercel.app/)             |

## 🚀 Need Help with Headless CMS Migration?

This repository is maintained by [FocusReactive](https://focusreactive.com) — a specialized Next.js and Headless CMS migration agency.

We help enterprise businesses migrate from legacy monoliths (WordPress, Drupal, Sitecore) and visual builders (Webflow, Framer) to modern stacks like Sanity, Payload CMS, Storyblok, and MedusaJS.

The pipeline in this repository is one path out of that matrix, published in full. The internal version of the same tooling covers the others — if your migration path isn't Webflow → Payload, ask us about it.

### Why FocusReactive?

- **Expertise:** Verified Sanity, Payload, and Storyblok partners.
- **Speed:** We use our proprietary [CMS Kit](https://github.com/focusreactive/cms-kit) to speed up migrations by 40%.
- **SEO & Performance:** Zero downtime migrations with 100/100 Lighthouse scores.

👉 **[Get a Free Migration Consultation](https://focusreactive.com/services/headless-cms-expert-agency/)** or contact us at contact@focusreactive.com.

## License

MIT — see [LICENSE](LICENSE).
