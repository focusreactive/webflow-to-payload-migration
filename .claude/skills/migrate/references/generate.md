# Generate stage: scaffold → gates

Turns the whole IR into a working Payload v3 + Next.js project on SQLite. Every
file in the deliverable is written by this tool — there is no boilerplate base
underneath it. **Never edit `.migration/` or any generated file by hand**: the
`src/scripts/generate/index.ts` CLI owns all writes. Unit statuses come from
`generate --plan`.

## 0. Preconditions

- Node 22+ and `pnpm` on PATH. That is the whole list.
- No database to provision: the deliverable uses `@payloadcms/db-sqlite` with
  `DATABASE_URI=file:./payload.db` inside the project, and the schema is pushed
  to match the config on boot (`push: true`), so there is no migration step.

## 1. `generate --plan`

    pnpm tsx src/scripts/generate/index.ts --project <p> --plan

Prints the stage's units and their manifest status: `generate:scaffold`
followed by the six gates. Nothing is written.

## 2. `generate --scaffold`

    pnpm tsx src/scripts/generate/index.ts --project <p> --scaffold

Writes the whole project: the shell (`package.json`, `tsconfig.json`,
`next.config.ts`, `eslint.config.mjs`, `postcss.config.js`, `.gitignore`,
`.env.example`, `README.md`), the `(payload)` admin/api route group, the
`payload.config.ts` with the SQLite adapter, the built-in `Media`, `Users` and
`Pages` collections, one collection per migrated CMS collection, one payload
global per chrome role, every synthesized block plus the `RenderBlocks`
renderer, the migration lib, the detail routes, the theme, the fonts and the
seed.

Records the resulting file list in `.migration/artifacts/generate-files.json`
and removes any previously-written file that fell out of the current IR
(`.env` is written outside the ledger, so it is never removed). Re-run with
`--force` after any IR change. Surface every printed warning to the user.

`.env` is written once, with fresh secrets, and never overwritten.

Seam errors:

- **"two route files claim the same URL"** — an emitted route file resolves to
  the same Next URL as another route file in the tree (route groups are
  ignored, dynamic segments compare by position, and an optional catch-all also
  claims the URL one level up). `next build` refuses this, so the stage fails
  instead. Rename the collection so its detail route gets a free segment.
- **"emission would overwrite files this tool did not write"** — an emission
  landed on a path that exists but is not in the previous run's ledger. Two
  writers disagree about who owns it; move the emission to a fresh path.

## 3. Gates — deterministic, resumable, in order

    pnpm tsx src/scripts/generate/index.ts --project <p> --gates

All six run from the project root.

| #   | gate        | command                       | blocking |
| --- | ----------- | ----------------------------- | -------- |
| 1   | `install`   | `pnpm install --ignore-workspace` | yes  |
| 2   | `types`     | `pnpm run generate:types`     | yes      |
| 3   | `importmap` | `pnpm run generate:importmap` | yes      |
| 4   | `seed`      | `pnpm run seed`               | yes      |
| 5   | `build`     | `pnpm run build`              | yes      |
| 6   | `lint`      | `pnpm run lint`               | no       |

`--ignore-workspace` matters: the deliverable is created inside a workspace
directory that is not its own, and without it a parent `pnpm-workspace.yaml`
would pull the project into a workspace it is not part of.

Each gate is its own manifest step (`generate:<gate>`); an already-done gate is
skipped. A blocking gate's failure stops the run with the output tail. Re-run a
single gate with `--gate <name> [--force]`. Triage:

- **install** fails → read the resolution error; do not hand-edit versions in
  the generated `package.json`, fix `src/scripts/generate/versions.ts` instead.
- **types**/**importmap** fail → these two can legitimately hang past their
  timeout on a cold Payload build; the gate treats that timeout as a success if
  the expected output file exists, so a timeout note is normal. A hard failure
  usually means a broken generated config — re-check the scaffold warnings.
- **seed** fails → the error names the collection, route or field. Fix the
  upstream IR (re-run the offending extraction unit), then `--scaffold --force`
  and `--gate seed --force`.
- **build** fails → this is the codegen correctness gate against the real,
  installed `payload`/`next`: read the error, fix the emitter or template in
  the tool (not the generated file), re-run scaffold and the gate.
- **lint** does not block. Its findings are written to
  `.migration/artifacts/generate/lint.txt` and reported; they are style, not a
  broken deliverable.

The stage is complete when `generate --plan` shows every unit done.

## Notes

- The seed reads `.migration/**` at runtime — it is an operator step; a cloned
  deliverable without `.migration/` cannot re-seed.
- Admin credentials live in the project's `.env`
  (`PAYLOAD_ADMIN_EMAIL` / `PAYLOAD_ADMIN_PASSWORD`) — rotate them.
- Hosting and database provisioning are not part of this stage.
