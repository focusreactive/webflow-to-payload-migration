# Probe phase

Capturing the site's entry surface: the home page, `robots.txt`, the sitemap and
a 404 page. Everything the next phase judges the platform on comes from here.
One script, one step (`probe`).

Entered once `init-project` is `done`. Every state change runs the script —
never write `.migration/*` by hand.

## Step 1 · probe (script, manifest step `probe`)

```
pnpm tsx src/scripts/probe/index.ts --project <projectPath> [--force]
```

```json
{ "step": "probe", "status": "done" }
```

Network I/O, in this order — the order matters, because `robots.txt` comes
first so its `Crawl-delay` applies to everything after it:

1. `<origin>/robots.txt` — parsed for `Crawl-delay` and `Sitemap:` directives.
   A `>=400` response is fine; the phase continues without them.
2. the `sourceUrl` home page — its response headers are the platform signals
   `detect` scores on, so they are written out alongside the body.
3. `<origin>/sitemap.xml`. If it answers `>=400`, the first **same-origin**
   `Sitemap:` directive from `robots.txt` is fetched in its place and stored
   under the same path.
4. `<origin>/__migration-probe-404__` — a path that cannot exist, so the
   response is the site's own 404 handling.

Every fetch goes through the snapshot store, so bodies are content-addressed and
a re-run costs no network.

**Repeating is safe.** On a project where the step is already `done` the script
prints `{"step":"probe","status":"skipped"}`, writes nothing and exits 0 —
continue to the next phase. Pass `--force` to re-fetch, which you want only when
the source site itself has changed.

## Verify

Read `<projectPath>/.migration/manifest.json`: `steps["probe"].status` is
`"done"`.

Under `<projectPath>/.migration/snapshot/probe/` there are five files:

| file             | holds                                                        |
| ---------------- | ------------------------------------------------------------ |
| `home.html`      | the home page body                                           |
| `headers.json`   | home `status`, `finalUrl`, `redirectChain`, response headers |
| `robots.txt`     | only when robots answered `<400`                             |
| `sitemap.xml`    | the root sitemap, or the robots fallback                     |
| `not-found.html` | the 404 body, whatever status the site returned              |

`headers.json` is the one file the snapshot registry does not track: the
registry drops response headers, and `detect` needs them.

`home.html` being absent (or the step never having run) is what makes every
later stage fail with `probe has not been run for this project` — if you see
that message anywhere downstream, this phase is what is missing.
