# Init-project phase

Entering a run: compute a RunConfig, confirm it with the user, create the
project. One script, two subcommands, one manifest step (`init-project`).

Every state change runs the script — never write `.migration/*` by hand.

## Step 1 · prepare (script)

```
pnpm tsx src/scripts/init-project/index.ts --prepare --url <url> \
  [--project-name <name>] [--workspace-path <path>] [--run-config <file>]
```

No network, writes nothing. It computes smart defaults (slug from the domain,
workspace path from tool config), resolves the project directory, and reads the
manifest there if one exists:

```json
{
  "runConfig": { "sourceUrl": "…", "projectName": "…", "workspacePath": "…" },
  "projectPath": "<workspacePath>/<projectName>",
  "verdict": "new" | "existing" | "collision",
  "manifest": null | { "sourceUrl": "…", "toolVersion": "…",
                       "initProject": "done" | "pending" }
}
```

Flags worth knowing:

- `--run-config <file>` seeds from an existing JSON file (e.g. a batch run);
  flags passed alongside override the file's values.

The whole site is migrated: there is no route allow-list to narrow it with.

## Step 2 · the verdict decides where you go

- **`new`** → this is a fresh migration. Continue with step 3.
- **`existing`** → `projectPath` already holds a run of this same site. **Do not
  continue this phase.** Read `references/operations.md` and take it from there;
  `manifest.initProject` tells you whether the step below is already closed.
- **`collision`** → a different site (or an unrelated folder) owns that
  directory. Show the user the folder path, the `sourceUrl` from `manifest` and
  the one you prepared, ask for a new project name, and re-run step 1 with
  `--project-name <new name>`.

Then confirm with the user. Show one summary screen from `runConfig`:
`projectName`, `workspacePath`, `sourceUrl`, plus the `projectPath` that will be
created. Ask for approval — always, there is no mode that skips it. If the user
wants changes, re-run step 1 with adjusted flags — never hand-edit the JSON.

## Step 3 · init (script, manifest step `init-project`)

Write the approved `runConfig` object to a throwaway file, e.g.
`<scratchpad>/run-config.json` (your session scratch dir, else
`/tmp/migrate-run-config.json`) — that working copy is not part of `.migration/`
and is fine to write directly. Then:

```
pnpm tsx src/scripts/init-project/index.ts --init --run-config <file>
```

```json
{ "projectPath": "…", "created": true }
```

`created: true` means the folder, `.migration/`, `run-config.json`,
`manifest.json` and `.gitignore` were written and the `init-project` step is
`done`.

The step is safe to repeat. On a project of the same site it prints
`created: false`, writes nothing but the missing manifest row, and exits 0 — in
particular it never overwrites `run-config.json`. On a collision it exits 1 and
names the site that owns the folder; go back to step 1 with a new
`--project-name`.

## Verify

`projectPath` from the output is what every later command takes as
`--project <projectPath>`. Read `<projectPath>/.migration/manifest.json`: it has
`sourceUrl`, `toolVersion` and `steps["init-project"].status == "done"`.
`<projectPath>/.migration/run-config.json` holds the approved config.
