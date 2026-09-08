# Webflow sections to Payload blocks

Webflow has no block model. A page in Webflow is one flat tree of divs, and the "sections" an editor
perceives are a visual convention, not a structure you can read out of the markup. Payload's page
model is the opposite: a page is an ordered list of typed blocks, each with its own fields. So
migrating page structure is not a translation — the block model does not exist on the source side and
has to be **derived** from the rendered page, then made explicit on the target side.

The derivation runs in three stages: name the repeated section types across the site, record where
each one occurs, then compose every route as an ordered list of those occurrences with their field
values.

## How is a block type distinguished from a block instance?

A **block type** is the reusable definition: an id, a human name, a role, and an exemplar — one route
plus the node ids on that route that best show what this type looks like. It optionally carries a
confidence score, and optionally a collection key when the type exists to render items of a
collection.

A **block instance** is one appearance: the route it appears on, its node ids there, its role, a
short summary, and its boundary rect. Instances are stored sharded per route, so a page's structure
can be read without loading the whole site's.

The separation matters because a hero used on six pages must become one Payload block with six
instances, not six near-identical block definitions. The exemplar is what the component is authored
against; the instances are what fill it with per-page content.

Globals are treated as a closed set rather than discovered freely: exactly two names are allowed,
`header` and `footer`. Anything shared across pages that is not one of those stays a block.

Collection item pages are decomposed differently again. Rather than a list of blocks, a collection
gets a representative item and a set of **sections**, each with an id, a role, a summary, node ids
and a boundary. A collection template is one layout reused across every item, so it is authored once
against the representative item.

## What does this become in Payload?

A `pages` collection with three fields — `title`, `slug`, and `layout`, a blocks field admitting
every discovered block type:

```ts
fields: [
  { name: "title", type: "text", required: true },
  { name: "slug", type: "text", required: true, unique: true, index: true },
  { name: "layout", type: "blocks", blocks: [/* every discovered block type */] },
];
```

Each CMS collection becomes its own Payload collection, grouped under `Content` in the admin, with
its first text field used as the document title and shown alongside `updatedAt` in the list view. Two
field-level rules are applied rather than inherited from the inference:

- **`slug` is always forced** to `text`, required, unique and indexed, whatever the inference
  produced. It is the field routing depends on, so it cannot be left to chance.
- **Relationship fields never carry `required`.** Seeding writes documents in an order that cannot
  guarantee a referenced document already exists, and a required relationship would make the seed
  fail on ordering rather than on data.

## Source in this repository

- [`src/ir/discovery.ts`](../src/ir/discovery.ts) — block types, instances, globals, collection
  sections
- [`src/ir/layout.ts`](../src/ir/layout.ts) — the per-route composition record and unit kinds
- [`src/scripts/generate/steps/scaffold/collections.ts`](../src/scripts/generate/steps/scaffold/collections.ts)
  — the emitted `pages` and CMS collection configs
- [`src/scripts/generate/templates/app-frontend/catch-all-page.tsx.tpl`](../src/scripts/generate/templates/app-frontend/catch-all-page.tsx.tpl)
  — route resolution

## Related

- [Reading a Webflow content model from a published site](read-webflow-content-model-from-published-site.md)
  — where the routes and collections come from
- [Freezing a published site so the migration is verifiable](freeze-a-published-site-for-verifiable-migration.md)
  — what the anchor ids refer to
- [Migration run metrics](migration-run-metrics.md) — the numbers above, in context

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
