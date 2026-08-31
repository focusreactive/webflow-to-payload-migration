import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { writeArtifact, writeNdjsonArtifact } from "#ir/artifact.ts";
import { blocksArtifact, type BlocksData } from "#ir/blocks.ts";
import { collectionsArtifact } from "#ir/collections.ts";
import { collectionIdSchema } from "#ir/common.ts";
import { designTokensArtifact } from "#tokens/schemas/design-tokens.ts";
import { globalDefSchema, globalsArtifact, type GlobalsData } from "#ir/globals.ts";
import { layoutRouteArtifactFor } from "#ir/layout.ts";
import { pagesArtifact } from "#ir/pages.ts";
import { initManifest } from "#lib/manifest/index.ts";
import { synthEntryDir } from "#lib/synth-store/paths.ts";

export const MINIMAL_TOKENS = {
  primitive: {
    color: {},
    fontFamily: {},
    fontSize: {},
    fontWeight: {},
    lineHeight: {},
    letterSpacing: {},
    spacing: {},
    radius: {},
    shadow: {},
    breakpoint: {},
  },
  semantic: { color: {} },
} as never;

export interface MinimalScaffoldFixtureOptions {
  blocks?: BlocksData;
  globals?: GlobalsData;
}

export async function buildMinimalScaffoldFixture(
  projectPath: string,
  opts: MinimalScaffoldFixtureOptions = {},
): Promise<void> {
  await initManifest(projectPath, { toolVersion: "0.0.0-test", sourceUrl: "https://acme.example" });
  await writeArtifact(projectPath, pagesArtifact, {
    provenance: "published",
    data: {
      pages: [
        { route: "/", kind: "static", sources: ["crawl"] },
        { route: "/works/alpha", kind: "item", collectionKey: "works", slug: "alpha", sources: ["crawl"] },
      ],
      collections: [{ key: "works", routePattern: "/works/:slug", itemCount: 1 }],
    },
  });
  await writeArtifact(projectPath, blocksArtifact, { provenance: "ai", data: opts.blocks ?? { blocks: [] } });
  const globals: GlobalsData = opts.globals ?? {
    globals: [
      globalDefSchema.parse({ name: "header", fields: [], values: {} }),
      globalDefSchema.parse({ name: "footer", fields: [], values: {} }),
    ],
  };
  await writeArtifact(projectPath, globalsArtifact, { provenance: "ai", data: globals });
  await writeArtifact(projectPath, collectionsArtifact, {
    provenance: "ai",
    data: {
      collections: [
        {
          key: collectionIdSchema.parse("works"),
          label: "Works",
          fields: [
            { name: "slug", type: { type: "text" }, required: true },
            { name: "title", type: { type: "text" }, required: true },
            { name: "excerpt", type: { type: "text" }, required: false },
            { name: "cover", type: { type: "text" }, required: false },
          ],
          pageBinding: { slugField: "slug", meta: { title: "title", description: "excerpt", ogImage: "cover" } },
          items: [
            {
              id: "alpha",
              _provenance: "ai",
              slug: "alpha",
              title: "Alpha",
              excerpt: "First entry",
              cover: "cover-alpha",
            },
          ],
          template: [{ sectionId: "hero", itemFields: ["title"] }],
        },
      ],
    },
  });
  await writeArtifact(projectPath, designTokensArtifact, { provenance: "ai", data: MINIMAL_TOKENS });
  await writeNdjsonArtifact(projectPath, layoutRouteArtifactFor("index"), {
    provenance: "ai",
    items: [],
    extraMeta: { unitKind: "static", route: "/" },
  });

  const worksHeroSynthDir = join(synthEntryDir(projectPath, "collections", "works"), "sections", "hero");
  await mkdir(worksHeroSynthDir, { recursive: true });
  await writeFile(
    join(worksHeroSynthDir, "Component.tsx"),
    "export default function Hero(props: Record<string, unknown>) {\n"
      + '  return <article>{String(props["title"] ?? "")}</article>;\n}\n',
  );

  // Both chrome roles, not just one: the shell's root layout renders each of them from its
  // own slot, so a fixture with a single role exercises only half of that seam.
  for (const def of globals.globals) {
    const role = def.name;
    const name = role === "header" ? "Header" : "Footer";
    const dir = synthEntryDir(projectPath, "globals", role);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "Component.tsx"),
      `import type { Global${name}Props } from "./props.ts";\n\n`
        + `export default function ${name}(props: Global${name}Props) {\n`
        + `  return <${role}>{Object.keys(props).length} ${role}</${role}>;\n}\n`,
    );
  }
}

// Stages the M5 blocks-stage output (config.ts/props.ts/Component.tsx) for one block, the way
// `finalizeBlockComponent` leaves it, so `runScaffold` can copy it into the deliverable.
export async function stageBlockFiles(
  projectPath: string,
  blockId: string,
  files: { configTs: string; propsTs: string; componentTsx: string },
): Promise<void> {
  const dir = synthEntryDir(projectPath, "blocks", blockId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "config.ts"), files.configTs);
  await writeFile(join(dir, "props.ts"), files.propsTs);
  await writeFile(join(dir, "Component.tsx"), files.componentTsx);
}
