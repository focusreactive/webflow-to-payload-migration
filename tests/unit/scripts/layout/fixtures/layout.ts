import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeArtifact } from "#ir/artifact.ts";
import { blocksArtifact, type BlockType, type BlocksData } from "#ir/blocks.ts";
import { pagesArtifact } from "#ir/pages.ts";
import { initManifest } from "#lib/manifest/index.ts";

export const HERO = {
  id: "hero",
  name: "Hero",
  source: { route: "/", anchorMigId: "mig-h" },
  fields: [
    { name: "title", type: { type: "text" }, required: true },
    { name: "subtitle", type: { type: "text" }, required: false },
    { name: "cover", type: { type: "image" }, required: false },
  ],
} as unknown as BlockType;

export function heroPayload(opts: { route: string; fields: Record<string, unknown>; anchorMigId?: string }): unknown {
  return {
    unit: { kind: "static", route: opts.route },
    missedFields: [],
    blocks: [
      {
        blockType: "hero",
        anchorMigId: opts.anchorMigId ?? "mig-h",
        confidence: 0.9,
        fields: opts.fields,
      },
    ],
  };
}

async function seedSnapshotIndex(projectPath: string, routes: string[]): Promise<void> {
  await mkdir(join(projectPath, ".migration/snapshot"), { recursive: true });
  const entries = Object.fromEntries(
    routes.map((route) => {
      const url = `https://site.example${route === "/" ? "/" : route}`;
      const pageDir = route === "/" ? "pages" : `pages${route}`;
      return [
        url,
        {
          url,
          kind: "page",
          paths: {
            raw: `${pageDir}/index.html`,
            rendered: `${pageDir}/index.rendered.html`,
            styles: `${pageDir}/index.styles.json`,
          },
          http: { status: 200, finalUrl: url, redirectChain: [] },
          sha256: "0".repeat(64),
          size: 1,
          fetchedAt: "2026-07-15T00:00:00.000Z",
        },
      ];
    }),
  );
  await writeFile(join(projectPath, ".migration/snapshot/index.json"), JSON.stringify({ schemaVersion: 2, entries }));
}

async function seedStitchIndex(projectPath: string, route: string, routeKey: string): Promise<void> {
  const stitchDir = join(projectPath, ".migration/artifacts/stitch", routeKey);
  await mkdir(stitchDir, { recursive: true });
  const url = `https://site.example${route === "/" ? "/" : route}`;
  await writeFile(
    join(stitchDir, "index.json"),
    JSON.stringify({
      schemaVersion: 1,
      provenance: "published",
      data: {
        route,
        url,
        capturedAt: "2026-07-15T00:00:00.000Z",
        stitches: {
          desktop: {
            file: "desktop.png",
            doc: { width: 1440, height: 2000 },
            dpr: 1,
            pixels: { width: 1440, height: 2000 },
            stickyRegions: [],
          },
        },
        elements: { "mig-h": { desktop: { rect: { x: 0, y: 100, width: 1440, height: 500 } } } },
      },
    }),
  );
}

export async function makeProject(): Promise<string> {
  const projectPath = await mkdtemp(join(tmpdir(), "layout-cli-"));
  await mkdir(join(projectPath, ".migration"), { recursive: true });
  await initManifest(projectPath, { toolVersion: "test", sourceUrl: "https://site.example" });
  await seedSnapshotIndex(projectPath, ["/"]);
  await seedStitchIndex(projectPath, "/", "index");

  await writeArtifact(projectPath, pagesArtifact, {
    provenance: "published",
    data: {
      pages: [{ route: "/", kind: "static", sources: ["sitemap"] }],
      collections: [],
    },
  });
  await writeArtifact(projectPath, blocksArtifact, {
    provenance: "ai",
    data: {
      blocks: [
        {
          id: "hero",
          name: "Hero",
          content: {},
          fields: [{ name: "title", type: { type: "text" }, required: true }],
        },
      ],
    } as unknown as BlocksData,
  });

  return projectPath;
}

export async function writeResponse(projectPath: string, routeKey: string, response: unknown): Promise<string> {
  const path = join(projectPath, ".migration/steps/layout", routeKey, "response.json");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(response));

  return path;
}
