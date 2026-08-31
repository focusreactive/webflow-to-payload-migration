# Existing project: operations menu

Entered from `phases/init-project/PHASE.md` step 2, when `--prepare` returns
verdict `existing` — the folder already holds a run of this same site. Also the
entry point when the user names a project path instead of a URL: there is no
`--prepare` for a path, so read `<projectPath>/.migration/manifest.json`
directly and check its `sourceUrl`. Read state yourself; never write
`.migration/*` by hand except by running a script.

This file is a router, not a manual. The pipeline order lives in `SKILL.md`;
every command, `--force` semantics and warning lives in that step's own phase
doc. Nothing here is a second copy of either.

## 1. Show current state

Read `<projectPath>/.migration/manifest.json` and summarize `steps` (each id →
`done`/`failed`/`running`/pending). Compute the next step per `SKILL.md`
"Determining the next step" — it walks the whole pipeline, AI phases included,
and says when the pipeline is complete or blocked. Then offer the operations
below.

## 2. Continue — run the next step

Open the next step's phase doc — `SKILL.md` "The pipeline" names it for every
step id — and follow it; the phase doc owns the command. After each run,
re-read `manifest.json` and recompute the next step; repeat until the pipeline
is complete. If a step's status was `failed`, tell the user it previously
failed before re-running it.

## 3. Re-run a step — force redo

Each phase doc documents `--force` for its own steps, next to the command,
together with what a force invalidates downstream. Read that doc. Two rules
hold across all of them:

- The delegated judgement steps take no `--force` — every `--*-accept`
  rewrites its artifact on every run, and re-serving a `--*-subject` is always
  safe. To redo one unit's judgement, re-serve its subject and delegate again.
- Never hand-edit `.migration/*` to undo or fake a step.

## 4. Start over — only via a new project

The skill never deletes project folders. For a fresh migration of the same
URL, go to `phases/init-project/PHASE.md` step 1 and re-run `--prepare` with a
new `--project-name`, then continue as a normal new migration. The old
directory is left untouched.

## 5. Refresh snapshot — re-crawl and re-render

Only on explicit request; it invalidates the frozen snapshot and every stage
built on it. `phases/snapshot/PHASE.md` step 2 has the command, what it clears
and what to warn the user about.

## 6. The verdict was `unknown`

There is no adapter to switch to: this tool migrates Webflow sites only.
`phases/detect/PHASE.md` step 2 has the walkthrough — show the signals that were
and were not found, and stop. The project folder stays on disk.
