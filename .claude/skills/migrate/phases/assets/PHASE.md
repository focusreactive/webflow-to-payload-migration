# Assets phase

Building the site's asset inventory: every image and video it references, and
every font family it uses. Each record carries a stable `assetId`, and that id
is what every later payload — synth content, layout, generate — uses to point at
an asset.

## Step 1 · media (script, manifest step `assets:media`)

```
pnpm tsx src/scripts/assets/index.ts --project <projectPath> --media [--force]
```

```json
{ "step": "assets:media", "status": "done", "assets": 128, "failed": 0 }
```

Report the asset count and flag `failed` whenever it is above zero.

Work, in this order:

1. **Scan.** Every mirrored `page` and `probe` body is read for `img src`, each
   `srcset` candidate, inline `background-image`, `w-json` lightbox payloads,
   `data-video-urls` / `data-poster-url`, and `og:image` / `twitter:image`
   meta. Every mirrored stylesheet is read for `url(...)` references. `data:`
   URIs are dropped; relative URLs are resolved against the body they came
   from.
2. **Canonicalize and group.** Webflow's `-p-<width>` responsive variants are
   skipped (they are re-derivable from the original) and the historical asset
   hosts (`assets.website-files.com`, `assets-global.website-files.com`,
   `uploads-ssl.webflow.com`) fold onto `cdn.prod.website-files.com`, so the
   same upload referenced from several pages under several hosts becomes one
   record. Its `sources` list every place it was found, its `alt` is the most
   frequent non-empty `alt` seen, and `kind` becomes `video` if any reference
   hinted video.
3. **Download.** Each canonical URL is fetched into the snapshot store. A
   response under 400 gives `status: "downloaded"` with `storePath`,
   `contentSha256`, `size` and `contentType`; anything else — or a thrown
   fetch — gives `status: "failed"` with `failureReason` and no `storePath`.
   A failed asset never fails the step.
4. **Content-dedup.** Records whose downloaded bytes hash identically are
   aliases: every one after the first gets `aliasOf` pointing at it, so an
   import uploads those bytes once.

Records are sorted by `assetId`, so the artifact is byte-stable across runs.

**Repeating is safe.** On a project where the step is already `done` the script
re-reads the existing artifact instead of re-scanning, prints
`{"step":"assets:media","status":"skipped",…}` with the same counts, writes
nothing, makes no network request and exits 0. Pass `--force` to rebuild, which
you want after a forced `snapshot` re-run or an adapter switch.

## Step 2 · fonts (script, manifest step `assets:fonts`)

```
pnpm tsx src/scripts/assets/index.ts --project <projectPath> --fonts [--force]
```

```json
{ "step": "assets:fonts", "status": "done", "fonts": 4, "licenseRisk": 1 }
```

Pure parsing of the mirror — no network, no adapter. `@font-face` rules from the
mirrored stylesheets and the page bodies, plus the Google families named in
`WebFont.load(...)` calls, are folded per family. Weight keywords carried in the
family name (`Inter Medium` → Inter at 500) are normalized away, and the family
is classified `google` / `fontshare` / `custom` / `adobe` from its `src` host,
which decides `downloaded` and `licenseRisk`.

**This step inventories fonts; it does not fetch them.** The binaries under
`.migration/snapshot/assets/fonts/` and `styles/fonts.css` were already written
by the snapshot phase. A font record's
`status: "downloaded"` only means it resolved without error — `font.downloaded:
false` and the absent `storePath` are what mark that there is no local file.

Report `licenseRisk` whenever it is above zero: those are `custom` or `adobe`
families, mirrored or referenced without a license check. It is a note for the
user, not a blocker.

**Repeating is safe**, the same way step 1 is: an already-`done` step re-reads
its artifact and prints `status: "skipped"`.

## Verify

```
pnpm tsx src/scripts/assets/index.ts --project <projectPath> --state
```

Prints one row per step; both must be `done`:

```json
{
  "phase": "assets",
  "steps": [
    { "id": "assets:media", "status": "done" },
    { "id": "assets:fonts", "status": "done" }
  ]
}
```

Read `<projectPath>/.migration/artifacts/assets/media.json`. Shape:
`{schemaVersion, provenance, data:{assets:[…]}}`, one record per image or video:

| field                        | holds                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `assetId`                    | 16 hex chars of sha256 over `canonicalUrl` — the id every later payload uses   |
| `kind`                       | `image` / `video`                                                              |
| `canonicalUrl`               | the folded CDN URL                                                             |
| `status`                     | `downloaded` / `failed`                                                        |
| `sources`                    | where it was referenced (`img-src`, `css-url`, `og-image`, …)                  |
| `fileName`                   | the upload's own file name, sanitized — the id prefix Webflow adds is stripped |
| `platformId`, `originalName` | that stripped 24-hex Webflow id and the undecorated name, when present         |
| `storePath`                  | path under `.migration/snapshot/assets/media/` — absent on `failed`            |
| `contentSha256`, `size`      | of the downloaded bytes                                                        |
| `alt`                        | the most frequent non-empty `alt`, when any reference carried one              |
| `aliasOf`                    | set when another record already holds identical bytes                          |
| `failureReason`              | why the download failed                                                        |

Every record with `status: "downloaded"` has its `storePath` file on disk under
`<projectPath>/.migration/snapshot/`.

Read `<projectPath>/.migration/artifacts/assets/fonts.json`. Same envelope, one record
per family: `assetId`, `kind: "font"`, `canonicalUrl` (the `src` URL, or
`font:<family>` for a family with no `src`), `sources` (`font-face` /
`webfont-load`), and `font` with `family`, `weights`, `style`, `classification`,
`downloaded`, `licenseRisk`.

The two files never overlap: the schema of each rejects the other's records, and
`font-face` / `webfont-load` are the only sources `assets/fonts.json` accepts.

If `assets/media.json` has an empty `assets` list on a site that visibly has images, the
snapshot mirror is what is missing, not this phase — check that
`.migration/snapshot/pages/<route>/index.html` and the `styles/` mirror exist.
