# Generate phase

Turns the whole IR into a working Payload v3 + Next.js project on SQLite, then
proves it works by installing, generating types and the import map, seeding,
building and linting it. Every file in the deliverable is written by this tool —
there is no boilerplate base underneath it, and **no generated file is ever
hand-edited**: the `src/scripts/generate/index.ts` CLI owns all writes.

Entered once `layout` is `done` — the phase reads `pages.json`, `blocks.json`,
`globals.json`, `collections.json`, `design-tokens.json`, the synth-staged
components under `.migration/artifacts/synth/`, the per-route layout NDJSON and the
snapshot's fonts.

Seven manifest steps, in this order, each its own CLI call:

| #   | step id              | command            |
| --- | -------------------- | ------------------ |
| 1   | `generate:scaffold`  | `--scaffold`       |
| 2   | `generate:install`   | `--gate install`   |
| 3   | `generate:types`     | `--gate types`     |
| 4   | `generate:importmap` | `--gate importmap` |
| 5   | `generate:seed`      | `--gate seed`      |
| 6   | `generate:build`     | `--gate build`     |
| 7   | `generate:lint`      | `--gate lint`      |

There is no state or plan command: read `steps["generate:*"]` in
`<projectPath>/.migration/manifest.json` and run the first one that is not
`done`. Every step prints its own `done`/`skipped` line, so a repeat run of a
closed step is free and tells you so.

## Preconditions

- Node 22+ and `pnpm` on PATH. That is the whole list.
- No database to provision: the deliverable uses `@payloadcms/db-sqlite` with
  `DATABASE_URI=file:./payload.db` inside the project, and the schema is pushed
  to match the config on boot (`push: true`), so there is no migration step.

## Step 1 · scaffold (script, manifest step `generate:scaffold`)

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --scaffold [--force]
```

```json
{ "step": "generate:scaffold", "status": "done", "files": 74, "warnings": [] }
```

Writes the whole project in one pass: the shell (`package.json`,
`tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.js`,
`.gitignore`, `.env.example`, `README.md`), the `(payload)` admin/api route
group, the `payload.config.ts` with the SQLite adapter, the built-in `Media`,
`Users` and `Pages` collections, one collection per migrated CMS collection, one
payload global per chrome role, every synthesized block plus the `RenderBlocks`
renderer, the migration lib, the detail routes, the theme, the fonts and the
seed.

It records the resulting file list in
`.migration/artifacts/generate-files.json` and deletes any previously-written
file that fell out of the current IR. `.env` is written once, with fresh
secrets, outside that ledger — so stale-file removal can never delete the
secrets it holds, and a re-run never overwrites them.

**Surface every line of `warnings` to the user.** They are the phase's only
report of IR gaps that do not stop the run: a collection with no
`collections.json` entry or an empty section template (no detail route), a
staged section missing its `Component.tsx`, a static route with no layout NDJSON
(the page is seeded as an empty draft), a collection slug renamed after a
collision, two sections sharing a richText field name, and a missing or empty
snapshot `fonts.css` (the app ships without webfonts).

**Repeating is safe.** On a project where the step is already `done` the script
prints `{"step":"generate:scaffold","status":"skipped"}`, writes nothing and
exits 0. Pass `--force` after any IR change — that is the only way the
deliverable picks up re-run upstream units.

Two errors stop the step, and both mean the emission plan itself is wrong:

- **"two route files claim the same URL"** — an emitted route file resolves to
  the same Next URL as another route file in the tree (route groups are
  ignored, dynamic segments compare by position, and an optional catch-all also
  claims the URL one level up). `next build` refuses this, so the step fails
  before writing rather than after. Rename the collection so its detail route
  gets a free segment.
- **"emission would overwrite files this tool did not write"** — an emission
  landed on a path that exists but is not in the previous run's ledger. Two
  writers disagree about who owns it; move the emission to a fresh path.

Two more fail loud on a broken upstream stage: a global missing its
`Component.tsx` (run the `synth:globals --finalize --global <name>` unit first)
and a block missing `config.ts`/`props.ts`/`Component.tsx` (the synth blocks
stage is not complete).

## Steps 2–7 · the gates (scripts, one manifest step each)

Each gate is one manifest step, run from the deliverable's own root with the
project's `.env` loaded into the environment. Every gate is idempotent: an
already-`done` gate prints `skipped` and runs nothing.

```json
{ "step": "generate:build", "status": "done" }
{ "step": "generate:build", "status": "skipped" }
```

A failing blocking gate stops the phase with the last 80 lines of the command's
output on stderr and leaves the step `failed`. Re-run one gate with
`--gate <name> --force` after fixing the cause.

### Step 2 · install (manifest step `generate:install`)

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --gate install [--force]
```

Runs `pnpm install --ignore-workspace` (15 min timeout). Blocking.

`--ignore-workspace` matters: the deliverable is created inside a workspace
directory that is not its own, and without it a parent `pnpm-workspace.yaml`
would pull the project into a workspace it is not part of.

**On failure** read the resolution error. Do not hand-edit versions in the
generated `package.json` — it is overwritten by the next scaffold. The single
source of the deliverable's dependency versions is
`src/scripts/generate/constants/versions.ts`, and changing it is tool work, not
run work: record it and route around it.

### Step 3 · types (manifest step `generate:types`)

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --gate types [--force]
```

Runs `pnpm run generate:types` (5 min timeout), which writes
`src/payload-types.ts`. Blocking.

This gate can legitimately hang past its timeout on a cold Payload build, so a
timeout with `src/payload-types.ts` present on disk is treated as success and
reported as a `note` on the printed line:

```json
{
  "step": "generate:types",
  "status": "done",
  "note": "pnpm run generate:types timed out but src/payload-types.ts exists — treated as success"
}
```

A hard failure means a broken generated config — re-read the scaffold warnings.

### Step 4 · importmap (manifest step `generate:importmap`)

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --gate importmap [--force]
```

Runs `pnpm run generate:importmap` (5 min timeout), which rewrites
`src/app/(payload)/admin/importMap.js`. Blocking, and carries the same
timeout-fallback rule as `types`, keyed on that file.

### Step 5 · seed (manifest step `generate:seed`)

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --gate seed [--force]
```

Runs `pnpm run seed` (40 min timeout): media first, then collection items in two
passes (pass 2 resolves references against the ids pass 1 recorded), then the
pages from `.migration/artifacts/generate/page-tree.json` and the per-route
layout NDJSON, then the globals. Blocking.

**On failure** the error names the collection, route or field. That is an IR
problem, not a seed problem: re-run the offending extraction unit upstream, then
`--scaffold --force` and `--gate seed --force`.

### Step 6 · build (manifest step `generate:build`)

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --gate build [--force]
```

Runs `pnpm run build` (20 min timeout). Blocking.

This is the codegen correctness gate against the real, installed
`payload`/`next` — the one check that compiles what was emitted rather than a
stand-in. **On failure** read the error and fix the cause upstream (the IR, or a
re-run synth unit), never the generated file: the next scaffold overwrites it.

### Step 7 · lint (manifest step `generate:lint`)

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --gate lint [--force]
```

Runs `pnpm run lint` (5 min timeout). **Not blocking** — its findings are style,
not a broken deliverable. eslint exiting nonzero does not fail the step; the
output tail is written to `.migration/artifacts/generate/lint.txt` and the
printed line points at it:

```json
{ "step": "generate:lint", "status": "done", "findings": ".migration/artifacts/generate/lint.txt" }
```

Report the findings to the user and close the phase.

## Verify

Read `<projectPath>/.migration/manifest.json`: all seven of
`generate:scaffold`, `generate:install`, `generate:types`,
`generate:importmap`, `generate:seed`, `generate:build` and `generate:lint` are
`"done"`.

Then, on disk under `<projectPath>`:

| path                                           | holds                                               |
| ---------------------------------------------- | --------------------------------------------------- |
| `.migration/artifacts/generate-files.json`     | `files`, `removed`, `warnings` of the last scaffold |
| `.migration/artifacts/generate/page-tree.json` | the nested page tree the seed wrote pages from      |
| `.migration/artifacts/generate/lint.txt`       | the lint findings, when the lint gate had any       |
| `package.json`, `src/payload.config.ts`        | the shell and its Payload config                    |
| `src/payload-types.ts`                         | written by the `types` gate                         |
| `payload.db`                                   | the seeded SQLite database                          |
| `.next/`                                       | the successful production build                     |

`.env` holds the admin credentials the seed created
(`PAYLOAD_ADMIN_EMAIL` / `PAYLOAD_ADMIN_PASSWORD`) — tell the user to rotate
them. `pnpm dev` in the project starts it; the admin is at `/admin`.

Two things this phase does not do, and the user should hear both: the seed reads
`.migration/**` at runtime, so it is an operator step — a cloned deliverable
without `.migration/` cannot re-seed; and hosting and database provisioning are
out of scope.
