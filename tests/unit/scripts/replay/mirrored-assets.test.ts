import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createReplayLookup } from "#replay/assets.ts";
import { writeArtifact } from "#ir/artifact.ts";
import { mediaAssetsArtifact, mediaAssetsDataSchema } from "#ir/assets.ts";
import type { FetchClient, FetchResponse } from "#lib/fetch/create-fetch-client/types.ts";
import { writeFileAtomic } from "#lib/fs.ts";
import { initManifest } from "#lib/manifest/index.ts";
import { writeRunConfig } from "#run-config/load.ts";
import { openSnapshotStore } from "#lib/snapshot-store/index.ts";
import { renderedPathFor, SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";

const PAGE_URL = "https://e.com/";
const CDN = "https://cdn.prod.website-files.com/6000000000000000000000aa";
const LOGO_URL = `${CDN}/6000000000000000000000bb_Brand%20Logo.svg`;
const LOGO_BODY = "<svg xmlns='http://www.w3.org/2000/svg'></svg>";

function fakeClient(bodies: Record<string, string>): FetchClient {
  return {
    fetch(url: string): Promise<FetchResponse> {
      const body = bodies[url];
      if (body === undefined) throw new Error(`unexpected fetch: ${url}`);
      return Promise.resolve({ status: 200, finalUrl: url, redirectChain: [], headers: {}, body: Buffer.from(body) });
    },
    setCrawlDelayMs() {},
  };
}

async function seed(project: string, opts: { withAssetFile: boolean }): Promise<void> {
  await initManifest(project, { toolVersion: "0.0.0", sourceUrl: PAGE_URL });
  await writeRunConfig(project, {
    sourceUrl: PAGE_URL,
    projectName: "e",
    workspacePath: ".",
  });

  const store = await openSnapshotStore(project, fakeClient({ [PAGE_URL]: "<html><body>raw</body></html>" }));
  const entry = await store.fetchInto(PAGE_URL, "page");
  const renderedRelPath = renderedPathFor(entry.paths.raw);
  await writeFileAtomic(join(project, SNAPSHOT_DIR, renderedRelPath), "<html><body>rendered</body></html>");
  await store.attachDerived(PAGE_URL, { rendered: renderedRelPath });

  await writeArtifact(project, mediaAssetsArtifact, {
    provenance: "published",
    data: mediaAssetsDataSchema.parse({
      assets: [
        {
          assetId: "aaaaaaaaaaaaaaaa",
          kind: "image",
          canonicalUrl: LOGO_URL,
          status: "downloaded",
          sources: ["img-src"],
          storePath: "assets/6000000000000000000000bb_brand-logo.svg",
          contentType: "image/svg+xml",
        },
      ],
    }),
  });

  if (opts.withAssetFile) {
    await mkdir(join(project, SNAPSHOT_DIR, "assets"), { recursive: true });
    await writeFile(join(project, SNAPSHOT_DIR, "assets", "6000000000000000000000bb_brand-logo.svg"), LOGO_BODY);
  }
}

async function lookup(project: string, url: string): Promise<{ body: Buffer; contentType?: string } | undefined> {
  const replay = await createReplayLookup(project);
  const id = replay.idFor(url);
  return id === undefined ? undefined : replay.read(id);
}

describe("mirrored asset lookup", () => {
  it("serves mirrored media that never entered the snapshot store", async () => {
    const project = await mkdtemp(join(tmpdir(), "replay-assets-"));
    try {
      await seed(project, { withAssetFile: true });
      const hit = await lookup(project, LOGO_URL);
      expect(hit?.body.toString()).toBe(LOGO_BODY);
      expect(hit?.contentType).toBe("image/svg+xml");
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  });

  it("folds a srcset variant onto the stored original", async () => {
    const project = await mkdtemp(join(tmpdir(), "replay-assets-"));
    try {
      await seed(project, { withAssetFile: true });
      const variant = `${CDN}/6000000000000000000000bb_Brand%20Logo-p-500.svg`;
      const hit = await lookup(project, variant);
      expect(hit?.body.toString()).toBe(LOGO_BODY);
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  });

  it("misses when the mirror file is gone, rather than serving a stale body", async () => {
    const project = await mkdtemp(join(tmpdir(), "replay-assets-"));
    try {
      await seed(project, { withAssetFile: false });
      expect(await lookup(project, LOGO_URL)).toBeUndefined();
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  });

  it("misses an url no asset record claims", async () => {
    const project = await mkdtemp(join(tmpdir(), "replay-assets-"));
    try {
      await seed(project, { withAssetFile: true });
      expect(await lookup(project, `${CDN}/6000000000000000000000cc_other.svg`)).toBeUndefined();
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  });
});
