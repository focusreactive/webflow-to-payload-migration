# Detect phase

Scoring the probed home page against the Webflow signal registry and writing a
verdict. One script, one step (`detect`).

Entered once `probe` is `done` (see `phases/probe/PHASE.md`). Every state
change runs the script — never write `.migration/*` by hand.

## Step 1 · detect (script, manifest step `detect`)

```
pnpm tsx src/scripts/detect/index.ts --project <projectPath> [--force]
```

```json
{ "verdict": "webflow" | "unknown", "scores": { "webflow": <n> } }
```

Show the verdict and the score.

**Repeating is safe.** On a project where the step is already `done`, the
script reads the existing artifact instead of rescoring and prints the same
shape. Pass `--force` to rescore — only useful if `probe` was re-run with
`--force` first, since detect scores whatever `probe` last captured.

## Step 2 · if the verdict is `unknown`, stop

This tool migrates Webflow sites and nothing else, so an `unknown` verdict ends
the run — there is no other adapter to fall back to.

Read (do not write) `<projectPath>/.migration/artifacts/detect.json`. Shape:
`{schemaVersion, provenance, data:{verdict, scores:{webflow:{score,
hasTier1Strong, signals:[{id,tier,evidence}]}}, thresholds, platformHints}}`.
Show the top signals (strong → medium → weak) from
`data.scores.webflow.signals` so the user can see what was and was not found,
say that the site does not look like a published Webflow site, and stop.

The project stays on disk, so the user can resume later once they have a
Webflow URL: `--prepare` will return `existing` and route to
`references/operations.md`.
