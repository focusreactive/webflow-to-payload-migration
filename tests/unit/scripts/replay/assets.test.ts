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

const ORIGIN = "https://e.com";
const HOME = `${ORIGIN}/`;
const LICENSE = `${ORIGIN}/info/license`;
const CDN = "https://cdn.prod.website-files.com/6000000000000000000000aa";
const LOGO_URL = `${CDN}/6000000000000000000000bb_Brand%20Logo.svg`;
const LOGO_VARIANT_URL = `${CDN}/6000000000000000000000bb_Brand%20Logo-p-500.svg`;
const LOGO_STORE_PATH = "assets/6000000000000000000000bb_brand-logo.svg";
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

async function seed(project: string): Promise<void> {
  await initManifest(project, { toolVersion: "0.0.0", sourceUrl: HOME });
  await writeRunConfig(project, {
    sourceUrl: HOME,
    projectName: "e",
    workspacePath: ".",
  });

  const store = await openSnapshotStore(
    project,
    fakeClient({ [HOME]: "<html><body>home</body></html>", [LICENSE]: "<html><body>license</body></html>" }),
  );
  const homeEntry = await store.fetchInto(HOME, "page");
  await store.fetchInto(LICENSE, "page");
  await writeFileAtomic(
    join(project, SNAPSHOT_DIR, renderedPathFor(homeEntry.paths.raw)),
    "<html><body>home</body></html>",
  );

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
          storePath: LOGO_STORE_PATH,
          contentType: "image/svg+xml",
        },
      ],
    }),
  });

  await mkdir(join(project, SNAPSHOT_DIR, "assets"), { recursive: true });
  await writeFile(join(project, SNAPSHOT_DIR, LOGO_STORE_PATH), LOGO_BODY);
}

async function withProject(run: (project: string) => Promise<void>): Promise<void> {
  const project = await mkdtemp(join(tmpdir(), "replay-lookup-"));
  try {
    await seed(project);
    await run(project);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}

describe("createReplayLookup", () => {
  it("gives the same id for the same url and different ids for different urls", async () => {
    await withProject(async (project) => {
      const lookup = await createReplayLookup(project);
      const first = lookup.idFor(HOME);
      expect(first).toBeDefined();
      expect(lookup.idFor(HOME)).toBe(first);
      expect(lookup.idFor(LICENSE)).not.toBe(first);
    });
  });

  it("returns undefined for a url the store never saw", async () => {
    await withProject(async (project) => {
      const lookup = await createReplayLookup(project);
      expect(lookup.idFor("https://example.com/never-fetched.png")).toBeUndefined();
    });
  });

  it("reads a body back by id", async () => {
    await withProject(async (project) => {
      const lookup = await createReplayLookup(project);
      const id = lookup.idFor(HOME);
      expect(id).toBeDefined();
      if (id === undefined) return;
      const body = await lookup.read(id);
      expect(body?.body.length).toBeGreaterThan(0);
    });
  });

  it("returns undefined for an unknown id", async () => {
    await withProject(async (project) => {
      const lookup = await createReplayLookup(project);
      expect(await lookup.read("deadbeefdeadbeef")).toBeUndefined();
    });
  });

  it("folds a webflow srcset variant onto the same id as the stored canonical asset", async () => {
    await withProject(async (project) => {
      const lookup = await createReplayLookup(project);
      const canonicalId = lookup.idFor(LOGO_URL);
      expect(canonicalId).toBeDefined();
      const variantId = lookup.idFor(LOGO_VARIANT_URL);
      expect(variantId).toBe(canonicalId);
      if (variantId === undefined) return;
      const body = await lookup.read(variantId);
      expect(body?.body.toString()).toBe(LOGO_BODY);
      expect(body?.contentType).toBe("image/svg+xml");
    });
  });

  it("resolves a trailing slash and a fragment onto the store's normalized id", async () => {
    await withProject(async (project) => {
      const lookup = await createReplayLookup(project);
      const canonicalId = lookup.idFor(LICENSE);
      expect(canonicalId).toBeDefined();

      expect(lookup.idFor(`${LICENSE}/`)).toBe(canonicalId);
      expect(lookup.idFor(`${LICENSE}#section`)).toBe(canonicalId);

      if (canonicalId === undefined) return;
      const body = await lookup.read(canonicalId);
      expect(body?.body.toString()).toBe("<html><body>license</body></html>");
    });
  });
});
