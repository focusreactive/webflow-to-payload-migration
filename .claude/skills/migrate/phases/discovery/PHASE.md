# Discovery phase

Builds the three per-vertical inventories the rest of the pipeline is authored
against — `discovery/globals.json`, `discovery/blocks.json`,
`discovery/collections.json` — by **layered subtraction**: the header and footer
are found first, they are then subtracted from every route so the page
segmentation only ever sees content, and the per-route sections are finally
folded into site-wide block types.

```
pnpm tsx src/scripts/discovery/index.ts --project <projectPath> --state
```

prints one row per step; it is the fastest way to see where the phase stands.

## How a judgement is delegated

The three judgements share one shape. The subagent runs the schema step, runs
the subject step, writes its answer to the path the subject printed, and runs
acceptance itself until acceptance passes. Only the flags differ.

`judge` writes **only** the response file — it creates no artifact. The artifact
appears when `accept` returns 0, so an unvalidated answer can never reach
`.migration/artifacts/`.

Acceptance behaves the same way everywhere: exit `0` writes the artifact and
marks the steps, exit `1` prints **every** error at once as
`{"ok":false,"errors":[…]}` and writes nothing.

## Step 1 · globals schema, subject, judge, accept

Finds the site's header and footer on one source route. Delegate as one unit.

```
Agent(
  subagent_type: "general-purpose",
  description:   "discover globals",
  prompt: "Run these in order and read every line of the output:

             pnpm tsx src/scripts/discovery/index.ts --project <projectPath> --globals-schema
             pnpm tsx src/scripts/discovery/index.ts --project <projectPath> --globals-subject

           The first prints the JSON Schema of the response. The second prints the
           source route, the routes to corroborate against, the downscaled stitch
           PNG, the rendered HTML and the exact path for the response file.

           Read the downscaled stitch PNG and the rendered HTML at those paths.
           Decide which node subtree is the header and which is the footer on the
           source route. nodeIds[0] is the root of the subtree — list further ids
           only when the global is split across sibling nodes. Write the response
           as JSON to exactly the printed path.

           Then accept your own work:

             pnpm tsx src/scripts/discovery/index.ts --project <projectPath> --globals-accept

           Exit code 1 means every error is printed in stdout: fix them ALL,
           rewrite the response at the same path, and run accept again.
           Exit code 0 means the artifact is written — return one line: its path.

           Do not finish before accept returns 0. If you cannot make it pass,
           return the error together with the last accept output.

           Create and modify nothing except the response file."
)
```

**Record the `agentId` from the result.** It is what you need if `--state` says
`discovery:globals:accept` is not `done`; wake the same subagent with
`SendMessage` and have it re-run acceptance until the exit code is 0.

Acceptance rejects a `nodeIds[0]` that is not a node of the source route
(`UNKNOWN_ID`) and a `corroboratedRoutes` entry with no captured stitch index
(`UNKNOWN_ROUTE`). On success it writes `discovery/globals.json` and marks both
`discovery:globals:judge` and `discovery:globals:accept`.

## Step 2 · blocks schema, subject, judge, accept (fan-out over routes)

Segments every representative route into visible sections, with the globals
subtracted. Representative routes = all static routes plus one item route per
collection.

Get the remaining routes first — no `--route`:

```
pnpm tsx src/scripts/discovery/index.ts --project <projectPath> --blocks-subject
```

```json
{ "step": "discovery:blocks:subject", "remaining": ["/", "/about", "/services"] }
```

A route drops off the list when its shard is written, so this is the progress
query for the whole fan-out. **One subagent per remaining route**, up to five at
a time:

```
Agent(
  subagent_type: "general-purpose",
  description:   "discover blocks for <route>",
  prompt: "Run these in order and read every line of the output:

             pnpm tsx src/scripts/discovery/index.ts --project <projectPath> --blocks-schema
             pnpm tsx src/scripts/discovery/index.ts --project <projectPath> --blocks-subject --route <route>

           The first prints the JSON Schema of the response. The second prints the
           downscaled stitch PNG, the rendered HTML, the node ids that belong to
           the header and footer (excludeNodeIds — these are NOT blocks), and the
           exact path for the response file.

           Segment the route into visible sections — hero, feature grid,
           testimonial strip — not atoms and not the whole page. role is a short
           semantic name, summary is one sentence that helps match the same
           section across routes. nodeIds[0] is the section root. Write the
           response as JSON to exactly the printed path.

           Then accept your own work:

             pnpm tsx src/scripts/discovery/index.ts --project <projectPath> --blocks-accept --route <route>

           Exit code 1 means every error is printed in stdout: fix them ALL,
           rewrite the response at the same path, and run accept again.
           Exit code 0 means the shard is written — return one line: the route.

           Do not finish before accept returns 0. If you cannot make it pass,
           return the error together with the last accept output.

           Create and modify nothing except the response file."
)
```

Acceptance rejects a `route` that is not the one served (`ROUTE_MISMATCH`), a
node absent from that route's stitch index (`UNKNOWN_ID`), and a section rooted
inside the header or footer (`EXCLUDED_CHROME`). Each run prints the routes still
missing a shard:

```json
{ "ok": true, "route": "/", "instances": 7, "remaining": ["/about"] }
```

`discovery:blocks:subject`, `discovery:blocks:judge` and
`discovery:blocks:accept` all flip to `done` on the run that empties
`remaining` — one row per step, one closure for the whole fan-out.

## Step 3 · dedup schema, subject, judge, accept

Folds the per-route sections into site-wide block types. Runs only when every
representative route has a shard. Unlike the first two judgements the subject is
delivered **inline**: the subject step prints every instance from the static
routes' shards, so the verdict must cover all of them.

```
Agent(
  subagent_type: "general-purpose",
  description:   "dedup block types",
  prompt: "Run these in order and read every line of the output:

             pnpm tsx src/scripts/discovery/index.ts --project <projectPath> --dedup-schema
             pnpm tsx src/scripts/discovery/index.ts --project <projectPath> --dedup-subject

           The first prints the JSON Schema of the response. The second prints
           every discovered instance with its route, node ids, role, summary and
           rects, a stitch PNG per route, and the exact path for the response
           file.

           Group the instances into site-wide types. Merge two instances only on a
           clear role and structure match — prefer under-merging, an over-merged
           type loses editable differences. EVERY listed instance must land in
           exactly one type; a one-off section becomes a type with one member. The
           exemplar must be one of the type's own members. Set collectionKey only
           on a collection-list type, otherwise null. Do not invent ids — the type
           id is minted by code from role. Write the response as JSON to exactly
           the printed path.

           Then accept your own work:

             pnpm tsx src/scripts/discovery/index.ts --project <projectPath> --dedup-accept

           Exit code 1 means every error is printed in stdout: fix them ALL,
           rewrite the response at the same path, and run accept again.
           Exit code 0 means the artifact is written — return one line: its path.

           Do not finish before accept returns 0. If you cannot make it pass,
           return the error together with the last accept output.

           Create and modify nothing except the response file."
)
```

Acceptance rejects a member that was never listed (`UNKNOWN_ID`), an instance
claimed by two types (`DUPLICATE_ID`), an exemplar outside its own members
(`EXEMPLAR_NOT_MEMBER`), and any listed instance left without a type
(`INPUT_NOT_COVERED`). On success it writes `discovery/blocks.json` and marks
`discovery:dedup:judge` and `discovery:dedup:accept`.

## Step 4 · collections (script)

```
pnpm tsx src/scripts/discovery/index.ts --project <projectPath> --collections [--force]
```

```json
{ "step": "discovery:collections", "status": "done" }
```

Deterministic, no AI. For each collection it takes the representative item
route's shard, orders its sections by desktop `y` and mints a stable section id
per role (`hero`, `hero-2`, `cta`), then writes `discovery/collections.json`.

**Repeating is safe.** On a project where the step is already `done` it prints
`{"step":"discovery:collections","status":"skipped"}` and writes nothing. Pass
`--force` to rebuild, which you want after re-accepting an item route's shard.

## Step 5 · finalize (script)

```
pnpm tsx src/scripts/discovery/index.ts --project <projectPath> --finalize [--force]
```

```json
{ "step": "discovery:finalize", "status": "done" }
```

Reads all three inventories back — a missing or schema-invalid one fails the
step — records them against the manifest and closes the phase.

**Repeating is safe**, same contract as step 4.

## Verify

```
pnpm tsx src/scripts/discovery/index.ts --project <projectPath> --state
```

All fourteen rows `done`. `discovery:*:judge` rows are marked by their acceptance
step, never on their own.

Under `<projectPath>/.migration/artifacts/discovery/`:

| path                               | holds                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `globals.json`                     | one type per global (`header`, `footer`), its exemplar naming the source route and every node id the chrome occupies       |
| `blocks.json`                      | site-wide block types with minted ids, each naming the exemplar's route and every node id it spans                           |
| `collections.json`                 | one entry per collection: representative item route and its ordered sections                                                 |
| `blocks/<routeKey>.json`           | the per-route shards the fan-out produced                                                                                    |
| `_evidence/<routeKey>.desktop.png` | the downscaled stitch a subject step wrote for grounding                                                                     |

`jq '.data.types | length' …/discovery/blocks.json` greater than zero is the
quickest check that dedup actually landed; acceptance already refused a response
that left any shard instance without a type (`INPUT_NOT_COVERED`), so the shards
under `discovery/blocks/` remain the per-occurrence record.

Raw judgement answers live under `<projectPath>/.migration/steps/discovery/` and
are not artifacts — they are the state of the acceptance loop and may be
overwritten freely.

## Known deviation: how the subject reaches globals and blocks

For **dedup** the subject is delivered as the architecture requires — the full,
code-known list of instances printed inline, with acceptance checking that every
one of them is covered.

For **globals** and **blocks** it is not. Their subject is the rendered page, and
the subject step hands it over as two paths — the downscaled stitch PNG and the
rendered HTML — leaving the model to decide how much of a 2.8 MB HTML file to
read. There is also no coverage check possible: the code does not know how many
sections a route ought to have.

This is a recognised gap, not an oversight. The way out — the model naming a band
on the screenshot and a script resolving that band to node ids, which makes the
subject finite, printable inline and checkable — is worked out and measured in
`docs/investigations/2026-08-30-discovery-frame-resolution.md`. It changes the
phase's logic and is deliberately deferred.

Two consequences to keep in mind while it stands:

- `corroboratedRoutes` in the globals response is not carried into the artifact
  and proves nothing; acceptance only checks that the named routes were
  captured.
- a header or footer whose root node differs between routes is described by the
  source route alone, so per-route node id instability is not handled here.
