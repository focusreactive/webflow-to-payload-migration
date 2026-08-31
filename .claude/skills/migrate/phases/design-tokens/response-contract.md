# Design tokens — response contract

The candidates step prints the path the response must be written to, followed
by every candidate as JSON. Each candidate needs a verdict, keyed by its id.
`gradients` carry no id and no verdict — they are there as context for the
palette.

Two tiers of colour, one flat list of names for every other category.

## Tier 1 — primitives (colors.primitives)

The name comes from the colour itself: `<hue>-<scale>`, e.g. `slate-50`,
`teal-600`, `ink-950`, `lime-400`. There is no fixed hue vocabulary — derive one
from this site's palette. The scale number comes from lightness, so candidates
with close oklch values become steps of the same hue.

Translucent colours never become primitives. A white film such as
`rgba(255,255,255,0.7)` is a Tier 2 role expressed with `color-mix`.

## Tier 2 — semantic roles (colors.roles)

The name describes the role in the UI; the value is always a reference to a
Tier 1 primitive or a `color-mix`. Role names are free — they are not checked
against a vocabulary.

Suffix convention — this is the whole convention:

| suffix         | meaning                                         |
| -------------- | ----------------------------------------------- |
| `X`            | the role colour itself: background / fill       |
| `X-foreground` | text on that background, contrast guaranteed    |
| `X-hover`      | interactive state                               |
| `X-soft`       | muted / tinted variant for backdrops and badges |
| `X-muted`      | lowered emphasis (also `muted-X`)               |
| `X-strong`     | reinforced variant                              |

Exactly two value forms are accepted:

```
{primitive.color.NAME}
color-mix(in oklab, {primitive.color.NAME} 70%, transparent)
```

A reference may also point at another role: `{semantic.color.NAME}`. References
must resolve and must not form a cycle.

## Coverage

Every colour candidate is accounted for exactly once: either it appears in
`colors.primitives`, or one role carries its id in `candidateId` and reproduces
its value. A role that reproduces no observed colour sets `candidateId` to `""`.

## Every other category

Name every candidate exactly once. Names are kebab-case (`[a-z0-9]` and single
dashes) and unique within their category; colour names are unique across
primitives and roles together, because both land in the same `--color-*` CSS
namespace.
