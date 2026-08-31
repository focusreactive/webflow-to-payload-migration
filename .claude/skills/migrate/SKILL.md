---
name: migrate
description: Migrate a published Webflow site to Payload CMS. Use when the user asks to migrate a site by URL or resume an existing migration.
---

# /migrate

This skill **drives the migration pipeline directly**: it resolves project
state by reading `.migration/`, then runs each stage's script in a fixed order.

## Hard rule: scripts own writes, the skill owns orchestration

- The skill **reads** state directly with the Read tool:
  `.migration/manifest.json`, `.migration/run-config.json`, and
  `.migration/artifacts/*.json`. These are the source of truth.
- The skill **never writes** under `.migration/` by hand. Every state change
  runs a real script (`src/scripts/**/index.ts`, `src/run-config/**/index.ts`)
  via Bash.
- If a script fails, the fix is another script run with better input — never a
  hand-edit of project files. See the read-only rule below.

## Hard rule: the tool repo is read-only, and the run is yours to finish

A migration run **never modifies this repository**. Not `src/`, not `tests/`,
not configs (`package.json`, `migrate.config.json`, `playwright-mcp.json`,
`.mcp.json`), not `docs/`, not this skill. No edits, no new files, no `git`
subcommand that touches the tree (`add`, `commit`, `stash`, `checkout`,
`reset`, `clean`, `restore`). Read the tool source as much as you like —
write nothing outside `<projectPath>`.

**Hit a problem? Solve it yourself, inside the run.** A failing script, a
rejected payload, a stuck lane, a tool bug you just diagnosed — none of these
is a reason to patch the repo, and none is a reason to stop and hand the
problem back to the user. Find the way forward with what the pipeline already
gives you: re-read the failing script's own error list and author a corrected
payload; re-run the step; narrow or widen scope; restart `replay`/`harness` or
take a free MCP lane; or record what is still open, mark it for review and move
on. Then keep going to the next step.

**Found a real tool bug? Write it down and route around it.** Collect such
findings and report them once the run is finished — fixing the tool is
separate work, in a separate session, on a clean tree.

## The pipeline

Phases, in the order the skill runs them:

| phase           | link                            |
| --------------- | ------------------------------- |
| `init-project`  | `phases/init-project/PHASE.md`  |
| `probe`         | `phases/probe/PHASE.md`         |
| `detect`        | `phases/detect/PHASE.md`        |
| `inventory`     | `phases/inventory/PHASE.md`     |
| `snapshot`      | `phases/snapshot/PHASE.md`      |
| `assets`        | `phases/assets/PHASE.md`        |
| `design-tokens` | `phases/design-tokens/PHASE.md` |
| `discovery`     | `phases/discovery/PHASE.md`     |
| `synth`         | `phases/synth/PHASE.md`         |
| `layout`        | `phases/layout/PHASE.md`        |
| `generate`      | `references/generate.md`        |

## Determining the next step

One thing is not a manifest step: `init-project --prepare`, which computes the
RunConfig.

Read `manifest.steps` (`{ [stepId]: { status, error? } }`, status one of
`pending`/`running`/`done`/`failed`). Walk "The pipeline" table in order; the
first step not `done` is the next one — `failed` means it failed before (warn,
then retry), `running` means it was interrupted (retry). Open that step's phase
doc and follow it; the phase doc owns its own step ids, commands, `--force`
semantics and internal loops. Never plan a step from this file alone.

When every applicable step is `done`, the pipeline is complete.
