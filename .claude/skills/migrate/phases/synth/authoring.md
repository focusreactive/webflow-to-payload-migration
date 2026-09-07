# Authoring a surface

One author owns one surface from its fields to `--accept`. Nothing you hold in context survives
past this file: everything that matters is on disk.

Every command is the same entrypoint:

```
pnpm tsx src/scripts/synth/index.ts --project <projectPath> <flag> …
```

`<entity-flag>` is `--collection <key>` / `--global <name>` / `--block <typeId>`; the vertical is
read off which one you name. Collection surfaces are synthesized per **section**: add
`--section <id>` to every flag from `--input-build` onward (see "Collection sections" below).

Your own sequence:

```
--fields-schema   → --fields-subject   → (write the response) → --fields-accept
--content-schema  → --content-subject  → (write the response) → --content-accept
--input-build
--draft-subject   → (write Component.tsx)
--richtext-schema → --richtext-subject → (write the response) → --richtext-accept
--accept --harness-origin <harnessOrigin>
```

No step takes a `--payload`: every schema/subject step prints the path its answer goes to, and the
matching accept step reads it from there. Acceptance behaves the same way everywhere — exit `0`
writes the artifact, exit `1` prints **every** error at once and writes nothing.

The reference is read only through your MCP lane, never off disk.

## Reading the reference

The replay server serves the reference page with its anchor map and a stamper already inlined, so
by the time the page has loaded every mapped element carries a `data-mig-id` and
`window.__migStamped` holds `{ total, stamped, missing }`. That attribute is how you address a node
on the **reference** — the candidate never carries it.

```
browser_navigate("http://localhost:<replayPort>/r/<route>")
browser_evaluate("() => window.__migStamped")
browser_evaluate("() => document.querySelector('[data-mig-id=\"<id>\"]').outerHTML")
browser_evaluate("() => getComputedStyle(document.querySelector('[data-mig-id=\"<id>\"]'))['font-size']")
browser_take_screenshot()
```

If `__migStamped.missing` is not empty, some ids in the map no longer resolve on the live page —
report it rather than guessing which node was meant.

Geometry and typography come from `getComputedStyle` and `getBoundingClientRect` on the reference,
never from eyeballing a screenshot: the screenshot confirms look-and-feel, it is not a ruler. The
snapshot phase also wrote a per-route `index.styles.json` (curated computed properties per
`data-mig-id`) and `subtree.html` next to the mirror — the same numbers, already captured, when you
would rather read than probe.

Every reading is taken at your lane's window, and the lane opens at 1440×900 — the width
`src/lib/capture/defaults.ts` captured, and the only width `index.styles.json` describes. If you
resize to probe another width, resize back before you finish: the lane outlives your surface, and
the next author inherits whatever window you left.

## Fields (AI)

```
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --fields-schema  --<entity-flag> <key> [--section <id>]
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --fields-subject --<entity-flag> <key> [--section <id>]
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --fields-accept  --<entity-flag> <key> [--section <id>]
```

`--fields-schema` prints the response schema for exactly this address — a block wants
`{ name, fields[], collectionKey? }`, a global `{ fields[] }`, a collection
`{ label, fields[], pageBinding }`, and a collection **section** the different
`{ itemFields: [...] }` shape (the subset of the collection's fields whose values come from the item
document — everything else in the section is invariant, hardcoded content, the one sanctioned
exception to "no hardcoded content"). `--section` is what switches it.

`--fields-subject` prints the entity's grounding — its name/role, the exemplar `{route, nodeIds}`
to read on the reference, the collection keys available to bind to, and `responsePath`.

`--fields-accept` writes `schema.json` into the surface's own directory and, for a block, also
emits `config.ts` and `props.ts` next to it. It re-checks what the schema alone cannot: duplicate
field names (`DUPLICATE_FIELD`), a `pageBinding` that names a field the response never declared
(`PAGE_BINDING`), and a section listing an `itemFields` name the collection has no field for
(`UNKNOWN_ITEM_FIELD`). Repeating it overwrites the shard from the current response.

## Content (AI, collection-level)

```
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --content-schema  --<entity-flag> <key>
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --content-subject --<entity-flag> <key>
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --content-accept  --<entity-flag> <key>
```

`--content-schema` builds the response schema **from that entity's own accepted fields**, so it
needs `schema.json` to exist first; it is the exact record form the accept step will validate,
including the null-for-absent dialect (a `null` on an optional field means "not present" and is
dropped; a `null` on a required field is rejected by name). The wrapper key follows the vertical:
`{ literals }` for a block, `{ values }` for a global, `{ items: [...] }` for a collection.

`--content-subject` prints the fields, the exemplar (for a collection, the representative item's
route and the `slugField`), and `responsePath`. `--content-accept` writes `content.json`; for a
collection it also mints each item's `id` from `slugifyId(item[slugField])` and stamps
`_provenance: "ai"`. Repeating it overwrites the shard.

## input-build (deterministic)

```
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --input-build --<entity-flag> <key> [--section <id>]
```

No response: it reads `schema.json` + `content.json` and writes `input.json` — media fields resolved
from `assetId` to a ready `{src, alt?}`, richText fields converted from their raw literal into
Lexical `SerializedEditorState` JSON. Prints `{ step, entity, input }`. This is the file the
harness's `?input=` points at, and the one `--richtext-subject` reads next. Safe to repeat: it
recomputes the file from the shards every time.

## Draft (AI)

```
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --draft-subject --<entity-flag> <key> [--section <id>]
```

Prints everything the author needs to write the first `Component.tsx`, inline: the surface key, the
exemplar `{route, nodeIds}`, the accepted fields, the paths of `schema.json` / `content.json` /
`input.json`, the `componentPath` to write, and the theme token vocabulary (every token name, by
group and tier). Read-only and safe to repeat.

Read the exemplar's nodes on the reference, cross-reference them against the content shard by
matching text (reliable — the string is in both places), look at the reference screenshot, decide
the DOM structure yourself, and measure whatever the styles artifact did not already carry.

### Authoring contract

- Geometry and typography come from measurement on the reference, never from eyeballing the
  screenshot.
- Tokens-first: a theme utility when the measured value matches a token, an arbitrary value with
  the exact measured pixels otherwise. No raw `<style>` blocks.
- Base classes carry the 1440 reading; a narrower width carries only its delta (see "Widths"). Never
  a bare `sm:` / `md:` / `lg:` — those are Tailwind's defaults, not this site's breakpoints.
- Write idiomatic, semantic React — headings, buttons, `<a>`, real form controls. No `data-mig-id`,
  ever, on the candidate.
- Media props arrive as ready-to-render `{src, alt?}` from `input.json` — render exactly what the
  props give you.
- richText fields are rendered by their generated wrapper (the richtext step), never hand-written.
- Item-/instance-varying content comes from props; invariant content is hardcoded only where the
  schema says so (or, for a collection section, everything outside `itemFields`).
- **Video rule:** if the reference has a background/looping `<video>`, render a real `<video>` with
  the same (rewritten) source — mirrored, not a `poster` still.

## richtext (AI)

```
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --richtext-schema  --<entity-flag> <key> [--section <id>]
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --richtext-subject --<entity-flag> <key> [--section <id>]
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --richtext-accept  --<entity-flag> <key> [--section <id>]
```

`--richtext-subject` prints, per richText field, the tags actually used in its `input.json` value
(`fields: [{ "field": "body", "tags": ["p", "strong", "a"] }]`) plus `responsePath`. For each tag,
measure it on the **reference** page and write
`{ "measured": { "<field>": { "<tag>": { "<cssProp>": "<value>", … } } } }` to that path.
`--richtext-accept` writes `richtext/<field>.tsx` — a generated wrapper, never hand-edited — and
prints the fields it wrote. Render it and forward the field's data:

```tsx
import RichTextBody from "./richtext/body";
// …
<RichTextBody data={props.body} />;
```

An entity with no richText fields gets an empty `fields` list from the subject and writes nothing on
accept; run the three steps anyway so the sequence stays uniform. Repeating accept regenerates the
wrappers from the current response.

## Interactive behaviour

A surface that reacts to the user — a menu that opens, a tab that switches, a card that lifts on
hover — carries that behaviour in `Component.tsx` like any other part of it. There is no separate
states step and no states file: the component is the record.

Drive the reference into each state yourself, on your own lane, with the ordinary MCP actions —
`browser_click`, `browser_hover`, `browser_press_key` — then read what changed and write it into
the component. Two habits keep the reading honest:

- Park the mouse somewhere off-content between probes, so the next reading does not inherit a stray
  hover state.
- After a probe that does not undo itself (a lightbox that leaves nodes behind when closed),
  navigate again rather than assuming a second click restored the page.

| what the reference shows                                    | what to write                                          |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| a property changes only under a forced pseudo-class         | a CSS variant: `hover:` / `focus-visible:` / `active:` |
| a property changes under a real event, not the pseudo-class | React state plus an event handler                      |
| the node has a `transition`                                 | the handler flips a class; the easing stays in CSS     |
| the node is absent after the stimulus                       | conditional rendering                                  |
| the node stays, a class or property changed                 | the same node, class toggled                           |
| something new appeared inside the entity's own subtree      | conditional rendering inside that node                 |
| something new appeared outside the entity                   | a portal into `body`                                   |
| something changed outside the entity without a new node     | a side effect of the handler                           |
| `src` or text changed                                       | nothing — that is content, not behaviour               |

## Widths

The source is desktop-first: its base rules apply at every width and `max-width` queries override
downward. Transcribe that cascade rather than inverting it — base classes hold the 1440 reading,
narrower widths hold only their deltas — and the frame you already matched cannot regress.

- The theme's `--breakpoint-*` tokens, printed in the draft vocabulary, are collected from
  `min-width` queries only, so they name the tiers **above** desktop. Use them as ordinary variants:
  `<token-name>:`.
- Tailwind's own `sm:` … `2xl:` survive in the deliverable and are **not** this site's breakpoints.
  Reaching for one invents a layout change at a width the source has none. Only token names and
  literal `max-[<px>]:` — literal is load-bearing, because the harness's Tailwind scans your file's
  text and never generates a variant assembled from a template string.

The tiers that carry the narrow layout are `max-width` queries, so they are not tokens. Read the
site's own off the reference:

```
browser_evaluate(`() => {
  const found = new Set();
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules } catch { continue }
    for (const rule of rules) {
      for (const match of (rule.media?.mediaText ?? "").matchAll(/max-width:\s*(\d+)px/g)) {
        found.add(Number(match[1]));
      }
    }
  }
  return [...found].sort((a, b) => b - a);
}`)
```

A Webflow site normally answers `[991, 767, 479]`. Probe each tier it declared, then put the lane
back:

```
browser_resize(991, 900) → re-read the exemplar's nodes → 767 → 479 → browser_resize(1440, 900)
```

Write a class only where a reading differs from the tier above it. A tier that reads the same gets
nothing — that is the whole test for whether this site changes there.

| what changes as the window narrows                    | what to write                                |
| ----------------------------------------------------- | -------------------------------------------- |
| a visible node becomes `display: none`                | `max-[<px>]:hidden`                          |
| a node hidden at 1440 becomes visible                 | render it, `hidden max-[<px>]:block`         |
| `flex-direction` turns column, or a grid loses tracks | that delta on the same node                  |
| font-size, padding or gap changes                     | the value measured at that width             |
| boxes only reflow, no property changed                | nothing — the fluid layout already does it   |
| a menu that opens on tap                              | behaviour, not width — see the section above |

A node hidden at 1440 is in neither the exemplar's `nodeIds` nor `index.styles.json`: zero-area
elements never reach the artifacts. Burger buttons and mobile menus live there, and the live page at
that width is the only place you will find them.

Check your own work the same way. The harness renders at the full document width with the site theme
loaded, so resize it to each tier and compare against the reference at that tier.

## accept (deterministic)

```
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --accept --<entity-flag> <key> [--section <id>] \
  --harness-origin <harnessOrigin>
```

Five checks, all of which must pass: `syntax` (the component parses as tsx), `input-covered` (every
declared field has a value in `input.json`), `input-used` (the component references every input
key), `assets-resolve` (every media value points at an inventoried asset) and `harness-renders`
(the harness serves this surface with a non-empty body).

Prints `{ step: "synth:accept", vertical, surface, accepted, checks }`. On success it writes the
surface's `record.json` with `phase: "done"` and the checks that closed it. On failure it writes
nothing, prints each failed check on stderr and exits 1 — fix the component or the shards and run
it again. Declaring the surface finished is your call; passing the five checks is what makes the
declaration cost something.

## Collection sections

Item routes are synthesized as per-collection **sections**, never as global blocks. `--fields-*`
without `--section` and every `--content-*` flag stay collection-level; every flag from
`--input-build` onward requires `--section <id>` in addition to `--collection <key>`, and
`--fields-*` accepts it too (that is what switches the fields response to `{ itemFields }`).

A section's artifacts (`schema.json`, `input.json`, `record.json`, `Component.tsx`, `richtext/`,
`responses/`) live under `.migration/artifacts/synth/collections/<key>/sections/<id>/`.

## Artifacts

Per surface, under `.migration/artifacts/synth/<vertical>/<surfaceKey>/`:

- `schema.json` — the accepted fields (a section's is `{ itemFields }`).
- `content.json` — the accepted content (collection-level for a sectioned vertical).
- `input.json` — the resolved literal the harness renders.
- `config.ts` / `props.ts` — block codegen, written by `--fields-accept`.
- `richtext/<field>.tsx` — generated wrappers.
- `Component.tsx` — the candidate, written by the author.
- `responses/<judgement>.json` — the raw model answer for `fields` / `content` / `richtext`. Not an
  artifact: overwritten on every retry, read only by that judgement's accept step.
- `record.json` — the surface record: `{ surface, phase, acceptedAt, checks }`, written by
  `--accept` only when all five checks pass.
