# Phase: synth

Turns each discovered entity into a working Payload surface: a field schema, its content, a
resolved `input.json`, generated richText wrappers, and a `Component.tsx` that reproduces the
reference frame. Three verticals run over this one phase — `collections`, `globals`, `blocks`.

Every command is the same entrypoint:

```
pnpm tsx src/scripts/synth/index.ts --project <projectPath> <flag> …
```

`<entity-flag>` is `--collection <key>` / `--global <name>` / `--block <typeId>`; the vertical is
read off which one you name. Collection surfaces are synthesized per **section**
(`discovery/collections.json` → `types[].sections`): add `--section <id>` to every flag from
`--input-build` onward. `--state` and `--finalize` take `--vertical <collections|globals|blocks>`
instead, because they work over the whole vertical rather than one entity.

There is no per-node join between reference and candidate. The candidate carries no `data-mig-id`
anywhere. Structure, tag names, wrapper divs: all free. What the author matches is what the
reference frame *looks like*.

The phase is two steps, one of them a nest of loops:

```
step 1  servers and preflight                once per project
step 2  the vertical                         × collections → globals → blocks, strictly serial
        2.1  state                           what to do next
        2.2  the entity                      × every entity of the vertical
             2.2.1  collection-level shards   collections only
             2.2.2  the surface               × every surface
                    fields → content → input-build → richtext → author → accept
        2.3  finalize                        closes the vertical
```

## Step 1 · servers and preflight (once per project, deterministic)

Two long-lived processes must already be up — started once per project, not per entity:

```
pnpm tsx src/scripts/replay/index.ts --project <projectPath> --port <port>   # reference
pnpm tsx src/scripts/harness/index.ts --project <projectPath>                # candidate
```

The replay server serves the reference site: `GET /r/<route>` (the route's HTML, URLs rewritten to
`/a/<sha>` and fonts injected), `GET /a/<sha>` (asset bytes), `GET /_health`. The harness serves
the candidate: it renders whatever `Component.tsx` a working entity currently has, at
`?kind=<block|global|detail>&entry=<synth path>&input=<input.json path>`, and also answers
`/_health`.

**The reference page arrives already marked up.** Replay injects two things into the page it
serves: the route's anchor map (`<script type="application/json" data-mig-anchors>`) and a small
stamper that walks the map on `load` and sets `data-mig-id` on each mapped element. After the page
has loaded, `window.__migStamped` holds `{ total, stamped, missing }`. If `missing` is not empty,
the anchor map has drifted from the mirror the map was built against — say so to the user rather
than authoring against a half-marked page.

Once both servers are up, before assigning any author a lane:

```
pnpm tsx src/scripts/synth/index.ts --project <projectPath> \
  --preflight --replay-origin <replayOrigin> --harness-origin <harnessOrigin>
```

Prints `{ ok, checks: [{ name, ok, detail }] }` over five checks — every viewport in
`src/lib/capture/defaults.ts` shares the same `deviceScaleFactor` as `playwright-mcp.json`'s
`browser.contextOptions.deviceScaleFactor` (`viewport-dpr`); every MCP lane's `--allowed-origins`
reaches both origins (`lane-origins`); the snapshot carries `fonts.css` (`fonts`); both servers
answer `/_health` (`health`); and `reference-styled`, which loads the first route in a real browser
and only runs when the other four passed. A non-zero exit means an author would be working against
a broken reference: fix it and rerun, do not proceed. Read-only and safe to repeat; it writes
nothing and records no manifest step.

## Step 2 · the vertical (one pass per vertical)

Steps 2.1 – 2.3 are one vertical's worth of work, and the phase is three passes of them, strictly
serial and in this order: `collections` → `globals` → `blocks`. Do not open the next vertical's
step 2.1 until the previous vertical's step 2.3 is `done`.

You own every loop below and never open a browser or touch a `Component.tsx` yourself: you run the
read-only and deterministic flags (`--state`, `--accept`) and delegate the rest. **Record the
`agentId` of every dispatch.** When a subagent returns but `--state` shows the surface did not
advance, wake that same subagent with `SendMessage` and have it finish — never do its work
yourself, and never run an acceptance step on its behalf.

**Every subagent in this phase runs on Sonnet.** Dispatch authors with `model: "sonnet"`, and keep
that model when you wake one with `SendMessage`.

Up to five surfaces are in flight at once across the vertical's entities, one per MCP lane declared
in `.mcp.json` (`pw-1` … `pw-5`, tool prefix `mcp__pw-N__browser_*`). **A lane belongs to the
surface, not to the subagent:** every subagent you dispatch for that surface is told the same lane,
and the lane frees up only when the surface reaches `phase: "done"` and the next pending surface
takes it. Two subagents sharing a lane stomp each other's browser state.

### Step 2.1 · state (deterministic, read-only)

```
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --state --vertical <vertical>
```

Prints `{ phase: "synth", vertical, steps: [{ id, status }], entities: [...] }`. `steps` carries
all three of the phase's manifest rows. Each entity carries `fields` / `content` (its
collection-level shards) plus a `surfaces` array — one row per unit of authoring work (the entity
itself for `blocks`/`globals`, one per section for `collections`) with
`{ surface, fields, input, richtext, component, phase }`. This is the only step that answers "what
next": pick a surface that is not `phase: "done"` and hand it to a free lane. Safe to repeat.

### Step 2.2 · the entity (one pass per entity of the vertical)

The vertical's entities come from step 2.1, each with its own `fields` / `content` booleans and its
`surfaces` array. Per entity: step 2.2.1 once, then step 2.2.2 for each of its surfaces. Entities
are independent of each other — the only ordering is 2.2.1 before any surface of that same entity.

#### Step 2.2.1 · collection-level shards (collections only, delegated)

A collection's fields and content are collection-level while its surfaces are per section, and the
sections cannot start without them: a section's `--fields-accept` validates its `itemFields`
against the collection's own fields (`UNKNOWN_ITEM_FIELD`), and `--input-build` reads
`content.json`. So one author does that pair for the entity first, on the lane the collection's
surfaces will use, and the sections fan out only once `--state` shows `fields: true` and
`content: true`.

```
Agent(
  subagent_type: "general-purpose",
  model:         "sonnet",
  description:   "synth collection shards for <key>",
  prompt: "You author the collection-level field schema and content of one collection.

           Read first, in full:

             .claude/skills/migrate/phases/synth/authoring.md

           Your MCP lane is pw-<N>: use only mcp__pw-<N>__browser_* tools, never another lane's.
           The reference site is at <replayOrigin>. Project path: <projectPath>.

           Run in order and read every line of the output — the schema step prints the JSON Schema
           of the response, the subject step prints its grounding and the exact path the response
           goes to:

             pnpm tsx src/scripts/synth/index.ts --project <projectPath> --fields-schema  --collection <key>
             pnpm tsx src/scripts/synth/index.ts --project <projectPath> --fields-subject --collection <key>

           Write the response as JSON to exactly that path, then accept your own work:

             pnpm tsx src/scripts/synth/index.ts --project <projectPath> --fields-accept  --collection <key>

           Then the same three for content: --content-schema, --content-subject, write the response,
           --content-accept.

           Exit code 1 means every error is printed in stdout: fix them ALL, rewrite the response at
           the same path, and run accept again. Do not finish before both accepts return 0. If you
           cannot make one pass, return the error together with the last accept output.

           Create and modify nothing except the two response files."
)
```

#### Step 2.2.2 · the surface (one pass per surface of the entity)

For `globals` and `blocks` the entity _is_ its single surface; a `collections` entity has one
surface per section. The surface runs on its own lane and is finished when its `--state` row reads
`phase: "done"` with `component: true`.

One dispatch per surface, holding the surface's lane from its fields to `--accept`. For
`collections` pass `--collection <key> --section <id>`; for the other two verticals the author also
does the fields and content pair step 2.2.1 covers, without `--section`.

```
Agent(
  subagent_type: "general-purpose",
  model:         "sonnet",
  description:   "synth <vertical>/<surface>",
  prompt: "You author one surface of the synth phase end-to-end and accept it.

           Read first, in full:

             .claude/skills/migrate/phases/synth/authoring.md

           Your MCP lane is pw-<N>: use only mcp__pw-<N>__browser_* tools, never another lane's.
           Reference site: <replayOrigin>. Candidate harness: <harnessOrigin>. Project path:
           <projectPath>. Your surface: <entity-flag> <key> [--section <id>].

           Run the sequence authoring.md lays out, in that order, and read every line of every
           output:

             --fields-schema / --fields-subject / (write the response) / --fields-accept
             --content-schema / --content-subject / (write the response) / --content-accept
                 ^ skip this pair for a collection section: it is collection-level and already done
             --input-build
             --draft-subject / (write Component.tsx at the printed componentPath)
             --richtext-schema / --richtext-subject / (write the response) / --richtext-accept
             --accept --harness-origin <harnessOrigin>

           No step takes a --payload: every schema/subject step prints the path its answer goes to.
           Exit code 1 on an accept means every error is printed in stdout: fix them ALL, rewrite
           the response at the same path, and run accept again.

           A section of the reference that reacts to the user — a menu that opens, a tab that
           switches, a card that lifts on hover — is part of what you reproduce. Drive the reference
           into that state yourself with your lane's browser_click / browser_hover, read what
           changes, and write the behaviour into Component.tsx. There is no separate states step and
           no states file: the component is the record.

           Do not finish before --accept returns 0. Return the JSON it printed. Create and modify
           nothing except the response files and Component.tsx."
)
```

`--accept` is deterministic and runs five liveness checks on what the author left behind:

| check             | what it asserts                                                        |
| ----------------- | ---------------------------------------------------------------------- |
| `syntax`          | `Component.tsx` parses as tsx                                          |
| `input-covered`   | every declared field has a value in `input.json`                       |
| `input-used`      | the component references every key of `input.json`                     |
| `assets-resolve`  | every media value points at an asset in `assets/media.json`            |
| `harness-renders` | the harness answers for this surface with a non-empty body             |

It prints `{ step: "synth:accept", vertical, surface, accepted, checks }`. Only when all five pass
does it write the surface's `record.json` with `phase: "done"`; otherwise it prints each failed
check on stderr and exits 1, and the surface stays open. Hand the failures back to the surface's
author — the record is the only thing that closes a surface.

### Step 2.3 · finalize (deterministic)

Closes one vertical and gates the next one: its step 2.1 does not open until this step is `done`.
Run it once every `surfaces[]` row of `--state --vertical <vertical>` reads `phase: "done"` with
`component: true`.

```
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --finalize --vertical <vertical>
```

Folds every entity's schema+content shard into the vertical's top-level artifact
(`collections.json` / `globals.json` / `blocks.json`) and records the single `synth:collections` /
`synth:globals` / `synth:blocks` manifest step. Prints
`{ step, status: "done" | "skipped", entities }`. Already `done` → `skipped` and nothing is
rewritten; `--force` redoes the fold.

For collections it additionally requires every discovered section to have both a `schema.json` and
a `Component.tsx`, and folds the ordered section list into `collections.json` as each collection's
`template`. For blocks it reads the already-folded `collections.json` for its collection-key list
and rejects a block whose `collectionKey` is not a known collection — which is why `blocks`
finalizes last. A vertical with an empty discovery inventory has no entities to author; its
`--finalize` still records the step with an empty top-level list.

## Verify

The phase is closed when all three manifest steps are `done` and every folded artifact is on disk:

```
jq '.steps["synth:collections"].status, .steps["synth:globals"].status, .steps["synth:blocks"].status' \
  <projectPath>/.migration/manifest.json
jq '.data.collections | length' <projectPath>/.migration/artifacts/collections.json
jq '.data.globals | length'     <projectPath>/.migration/artifacts/globals.json
jq '.data.blocks | length'      <projectPath>/.migration/artifacts/blocks.json
```

Then confirm no surface was left unfinished — for each vertical:

```
pnpm tsx src/scripts/synth/index.ts --project <projectPath> --state --vertical <vertical>
```

Every `surfaces[]` row must read `phase: "done"` with `component: true`. The surface's own record
carries the checks that closed it:

```
jq '.phase, .acceptedAt, .checks' \
  <projectPath>/.migration/artifacts/synth/<vertical>/<surfaceKey>/record.json
```
