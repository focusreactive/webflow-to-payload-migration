import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeArtifact } from "#ir/artifact.ts";
import { mediaAssetsArtifact, mediaAssetsDataSchema } from "#ir/assets.ts";
import type { FetchClient, FetchResponse } from "#lib/fetch/create-fetch-client/types.ts";
import { loadHtml } from "#lib/html.ts";
import { initManifest } from "#lib/manifest/index.ts";
import { createReplayLookup } from "#replay/assets.ts";
import { createReplayServer } from "#replay/server.ts";
import { writeRunConfig } from "#run-config/load.ts";
import { openSnapshotStore, readOnlyClient } from "#lib/snapshot-store/index.ts";
import { SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";

const ORIGIN = "https://e.com";
const HOME = `${ORIGIN}/`;
const HOME_HTML = "<html><head><title>home</title></head><body>home</body></html>";

const CDN = "https://cdn.example.com";
const CSS_URL = `${CDN}/styles/main.css`;
const BG_URL = `${CDN}/img/bg.png`;
const BG_STORE_PATH = "assets/bg.png";
// A relative reference: resolved against the css file's OWN url (not the
// serving path the browser fetched it from) this must land on BG_URL.
const CSS_BODY = "body{background:url(../img/bg.png)}";
const BG_BODY = "bg-bytes";

type FakeBody = string | { body: string; contentType: string };

function fakeClient(bodies: Record<string, FakeBody>): FetchClient {
  return {
    fetch(url: string): Promise<FetchResponse> {
      const raw = bodies[url];
      if (raw === undefined) throw new Error(`unexpected fetch: ${url}`);
      const body = typeof raw === "string" ? raw : raw.body;
      const headers = typeof raw === "string" ? {} : { "content-type": raw.contentType };
      return Promise.resolve({ status: 200, finalUrl: url, redirectChain: [], headers, body: Buffer.from(body) });
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

  const store = await openSnapshotStore(project, fakeClient({ [HOME]: HOME_HTML }));
  await store.fetchInto(HOME, "page");
}

// Adds a stylesheet snapshot entry (main.css, containing a relative url())
// plus the image it points at, registered as a downloaded asset — reproducing
// the shape a real crawl leaves behind: the css itself lives in the snapshot
// store, the binary it references lives in assets/media.json.
async function seedCssAsset(project: string): Promise<void> {
  const store = await openSnapshotStore(
    project,
    fakeClient({ [CSS_URL]: { body: CSS_BODY, contentType: "text/css" } }),
  );
  await store.fetchInto(CSS_URL, "style");

  await writeArtifact(project, mediaAssetsArtifact, {
    provenance: "published",
    data: mediaAssetsDataSchema.parse({
      assets: [
        {
          assetId: "1111111111111111",
          kind: "image",
          canonicalUrl: BG_URL,
          status: "downloaded",
          sources: ["css-url"],
          storePath: BG_STORE_PATH,
          contentType: "image/png",
        },
      ],
    }),
  });

  await mkdir(join(project, SNAPSHOT_DIR, "assets"), { recursive: true });
  await writeFile(join(project, SNAPSHOT_DIR, BG_STORE_PATH), BG_BODY);
}

const RENDERED_PATH = "probe/index.rendered.html";
const RENDERED_HTML =
  `<html><body><header data-mig-id="mig-7"></header>`
  + `<main><section data-mig-id="mig-8"></section></main></body></html>`;

// Reproduces what the rendered pass leaves behind: the post-JS html, stamped
// with the ids discovery anchors on, attached to the page entry.
async function seedRendered(project: string): Promise<void> {
  await mkdir(join(project, SNAPSHOT_DIR, "probe"), { recursive: true });
  await writeFile(join(project, SNAPSHOT_DIR, RENDERED_PATH), RENDERED_HTML);
  const store = await openSnapshotStore(project, readOnlyClient());
  await store.attachDerived(HOME, { rendered: RENDERED_PATH });
}

async function withProject(run: (project: string) => Promise<void>): Promise<void> {
  const project = await mkdtemp(join(tmpdir(), "replay-server-"));
  try {
    await seed(project);
    await run(project);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}

describe("createReplayServer", () => {
  it("answers the health probe", async () => {
    await withProject(async (project) => {
      const server = await createReplayServer({ projectPath: project });
      try {
        const response = await fetch(`${server.origin}/_health`);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true });
      } finally {
        await server.close();
      }
    });
  });

  it("serves a captured route", async () => {
    await withProject(async (project) => {
      const server = await createReplayServer({ projectPath: project });
      try {
        const response = await fetch(`${server.origin}/r/`);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/html");
        expect(await response.text()).toContain("<title>home</title>");
      } finally {
        await server.close();
      }
    });
  });

  it("rewrites a relative css url() against the asset's own url, not the serving path", async () => {
    await withProject(async (project) => {
      await seedCssAsset(project);
      const server = await createReplayServer({ projectPath: project });
      try {
        const lookup = await createReplayLookup(project);
        const cssId = lookup.idFor(CSS_URL);
        const bgId = lookup.idFor(BG_URL);
        expect(cssId).toBeDefined();
        expect(bgId).toBeDefined();
        if (cssId === undefined || bgId === undefined) return;

        const response = await fetch(`${server.origin}/a/${cssId}`);
        expect(response.status).toBe(200);
        expect(await response.text()).toContain(`/a/${bgId}`);
      } finally {
        await server.close();
      }
    });
  });

  it("serves the anchor map of the route it captured a rendered pass for", async () => {
    await withProject(async (project) => {
      await seedRendered(project);
      const server = await createReplayServer({ projectPath: project });
      try {
        const html = await (await fetch(`${server.origin}/r/`)).text();

        const $ = loadHtml(html);
        expect(JSON.parse($("head script[data-mig-anchors]").text())).toEqual({ "mig-7": [0], "mig-8": [1, 0] });
        // The map alone does nothing — the stamper that reads it ships with it.
        expect($("head script[data-mig-stamp]").length).toBe(1);
      } finally {
        await server.close();
      }
    });
  });

  it("serves a route without a rendered pass without a map", async () => {
    await withProject(async (project) => {
      const server = await createReplayServer({ projectPath: project });
      try {
        const html = await (await fetch(`${server.origin}/r/`)).text();

        expect(html).not.toContain("data-mig-anchors");
        expect(html).not.toContain("data-mig-stamp");
      } finally {
        await server.close();
      }
    });
  });

  it("404s an unknown route and an unknown asset id", async () => {
    await withProject(async (project) => {
      const server = await createReplayServer({ projectPath: project });
      try {
        expect((await fetch(`${server.origin}/r/nope/nowhere`)).status).toBe(404);
        expect((await fetch(`${server.origin}/a/deadbeefdeadbeef`)).status).toBe(404);
      } finally {
        await server.close();
      }
    });
  });
});
