# Layout phase

Composes every captured static route out of the block vocabulary synth produced:
one judgement per route, turning the page into an ordered list of block
instances with a literal value per field, written to
`layout/routes/<routeKey>.ndjson`. That NDJSON is what `generate` seeds each
page from — a route without it is seeded as an empty draft.

Only static routes are units here. Collection detail pages are not: their
sections were authored in the synth phase as the collection's `template`.

Entered once `synth:blocks` and `synth:globals` are `done` — `blocks.json` is
the vocabulary, and the chrome anchors resolved from `discovery/globals.json`
are handed to the author as exclusions. `assets/media.json`, when present, is
what asset ids are checked against.

```
pnpm tsx src/scripts/layout/index.ts --project <projectPath> --state
```

prints one row per step of the phase; it is the fastest way to see where the
phase stands.

## Step 1 · state (script, read-only)

```
pnpm tsx src/scripts/layout/index.ts --project <projectPath> --state
```

```json
{
  "phase": "layout",
  "steps": [
    { "id": "layout:route:/", "status": "done", "route": "/", "routeKey": "index" },
    { "id": "layout:route:/about", "status": "pending", "route": "/about", "routeKey": "about" },
    { "id": "layout", "status": "pending" }
  ]
}
```

One row per unit — a unit per static route that has a rendered snapshot, minted
as `layout:route:<route>` — then the stage-grain `layout` row that step 3
closes. This is the step that answers "what next": every unit row that is not
`done` still needs a judgement. Writes nothing and is safe to repeat.

## Step 2 · schema, subject, judge, accept (AI, delegated, fan-out over units)

One judgement per unit, and the four steps are one delegation: the subagent runs
the schema step, runs the subject step, writes its response to the path the
subject printed, and runs acceptance itself until acceptance passes.

`judge` writes **only** the response file — it creates no artifact. The artifact
appears when `accept` returns 0, so an unvalidated response can never reach
`.migration/artifacts/`.

Units are independent of one another: **one subagent per unit that is not
`done`**, up to five at a time.

```
Agent(
  subagent_type: "general-purpose",
  description:   "compose layout for <route>",
  prompt: "You compose one page of the site out of the block vocabulary.

           Run these in order and read every line of the output:

             pnpm tsx src/scripts/layout/index.ts --project <projectPath> --schema  --route <route>
             pnpm tsx src/scripts/layout/index.ts --project <projectPath> --subject --route <route>

           The first prints the JSON Schema of the response — the exact payload
           contract for THIS unit, typed from the block vocabulary. The second
           prints the unit's grounding: a stitch PNG per viewport, the rendered
           HTML, the computed styles, the block vocabulary, the site chrome
           anchors, and the exact path for the response file.

           Read the stitch PNGs and the rendered HTML at those paths. Map the page
           top to bottom onto the vocabulary's block types — one instance per
           non-chrome section, in visual order. Then write the response as JSON to
           exactly the printed path.

           Authoring rules:
           - Array order IS visual order, top to bottom; `order` is minted by code
             from the array position, so there is no order field to write.
           - anchorMigId is the section root's data-mig-id from the rendered HTML,
             and must exist in this unit's captures. One instance per section root.
           - SKIP site chrome: the `chrome` entries are the extracted
             header/footer. Chrome is NOT a layout block.
           - Every field value is a literal source — kind 'literal' carrying the
             value in IR record form: richText is an HTML string, image/file/video
             is an object of assetId and alt, with an assetId from assets.json.
           - A non-required field may be null instead of a value source — that is
             how you say the section does not have this field. A required field
             must always carry a value.
           - missedFields is required on every response; [] is the normal answer.
             Fill it only when a value you must place belongs to a collection field
             that the collection's schema does not have — report it there with
             evidence instead of hardcoding it. Acceptance then rejects the
             response and prints what to redo in synth first.
           - A page whose only sections are chrome is a legal empty response:
             blocks: [], missedFields: [].

           Then accept your own work:

             pnpm tsx src/scripts/layout/index.ts --project <projectPath> --accept --route <route>

           Exit code 1 means every error is printed in stdout: fix them ALL,
           rewrite the response at the same path, and run accept again.
           Exit code 0 means the artifact is written — return one line: its path.

           Do not finish before accept returns 0. If you cannot make it pass,
           return the error together with the last accept output.

           Create and modify nothing except the response file."
)
```

**Record the `agentId` of every dispatch.** It is what you need if `--state`
still shows that unit `pending`: wake the same subagent with `SendMessage` and
have it re-run acceptance until the exit code is 0. Never author or re-run
acceptance on its behalf.

Acceptance rejects, all errors at once as `{"ok":false,"errors":[…]}`:

| code                 | what it caught                                                        |
| -------------------- | --------------------------------------------------------------------- |
| `SCHEMA`             | the response does not match the printed contract                      |
| `UNKNOWN_ANCHOR`     | an `anchorMigId` that is not in the unit's captures                   |
| `DUPLICATE_ANCHOR`   | two instances anchored at the same section root                       |
| `UNKNOWN_BLOCK_TYPE` | a `blockType` outside the vocabulary                                  |
| `FIELD_TYPE`         | a literal value that does not match its field's type                  |
| `UNKNOWN_ASSET_ID`   | an `assetId` that is not in `assets/media.json`                       |
| `MISSED_FIELD`       | a reported schema gap — the `fix` names the synth steps to redo first |

On success it writes the unit's NDJSON, records it against the unit's manifest
step and marks that step `done`:

```json
{ "ok": true, "step": "layout:route:/", "artifact": "…/layout/routes/index.ndjson", "records": 7 }
```

Acceptance takes no `--force`: it rewrites the unit's NDJSON from the response
on every run, so re-running it is always safe. To redo a unit, re-serve its
subject, rewrite the response and delegate again. Nothing else in the phase
invalidates a unit — redoing a collection's judgements in synth does **not**
reset a unit that is already `done`, so re-run that unit yourself.

`--schema` and `--subject` are read-only and repeatable (the subject step only
creates the directory its response goes into). A failed acceptance leaves
nothing on disk: no artifact, no manifest row, no error report — the report is
the stdout the fixer already has.

## Step 3 · finalize (script)

```
pnpm tsx src/scripts/layout/index.ts --project <projectPath> --finalize [--force]
```

```json
{ "step": "layout", "status": "done", "units": 12 }
```

Closes the phase: it fails loud (`layout finalize: pending units: …`) unless
every unit step is `done`, and records the single `layout` manifest step.

**Repeating is safe.** On a project where the step is already `done` it prints
`{"step":"layout","status":"skipped","units":"unchanged"}` and writes nothing.
`--force` re-checks the units and re-stamps the step.

## Verify

```
pnpm tsx src/scripts/layout/index.ts --project <projectPath> --state
```

Every row `done`, the `layout` row included. Then the artifacts, one per unit:

```
jq -s 'length' <projectPath>/.migration/artifacts/layout/routes/<routeKey>.ndjson
```

counts the meta line plus the records — so `1` means a page composed of zero
blocks, which is only correct for a chrome-only page. The first line is the unit
meta (`unitKind: "static"`, `route`); every other line is one block instance
with its `order`, `blockType`, `anchorMigId`, literal `fields`, `_provenance`
and `_confidence`.

Raw judgement responses live under
`<projectPath>/.migration/steps/layout/<routeKey>/response.json` and are not
artifacts — they are the state of the acceptance loop and may be overwritten
freely.

## Known deviation: how the subject reaches the author

The subject of this judgement is a rendered page, and the subject step hands it
over as paths — the stitch PNG per viewport, the rendered HTML and the computed
styles — which leaves the model deciding how much of a large HTML file to read.
There is also no coverage check available: the code does not know how many
sections a route ought to have, so acceptance can only check the sections that
were reported, never that none was skipped.

This is the same recognised gap the discovery phase carries for its globals and
blocks judgements, and the way out is the same one measured in
`docs/investigations/2026-08-30-discovery-frame-resolution.md`. It changes the
phase's logic and is deliberately deferred.

One consequence to keep in mind while it stands: `discovery/blocks.json` already
holds the per-route section inventory, but this phase does not feed it to the
author or check the response against it — a section silently dropped from a page
shows up only as missing blocks in the generated page.
