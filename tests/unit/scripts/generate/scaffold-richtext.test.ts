import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runScaffold } from "#generate/scaffold.ts";
import { readArtifact, writeArtifact } from "#ir/artifact.ts";
import { collectionsArtifact } from "#ir/collections.ts";
import { synthEntryDir } from "#lib/synth-store/paths.ts";

import { buildMinimalScaffoldFixture } from "./fixtures/minimal-scaffold.ts";

function wrapper(size: string): string {
  return (
    'import { RichText } from "@payloadcms/richtext-lexical/react";\n'
    + 'import type { Props } from "./props.tsx";\n\n'
    + "export default function RichTextBody() {\n"
    + `  return <div className="[&_h2]:[font-size:${size}]" />;\n}\n`
  );
}

async function stageWrapper(entryDir: string, slug: string, contents: string): Promise<void> {
  await mkdir(join(entryDir, "richtext"), { recursive: true });
  await writeFile(join(entryDir, "richtext", `${slug}.tsx`), contents);
}

function sectionSynthDir(projectPath: string, sectionId: string): string {
  return join(synthEntryDir(projectPath, "collections", "works"), "sections", sectionId);
}

async function stageSection(projectPath: string, sectionId: string, componentName: string): Promise<void> {
  const dir = sectionSynthDir(projectPath, sectionId);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "Component.tsx"),
    `export default function ${componentName}(props: Record<string, unknown>) {\n`
      + '  return <article>{String(props["title"] ?? "")}</article>;\n}\n',
  );
}

/** Replaces the fixture's single-section template with a two-section one. */
async function useTwoSections(projectPath: string): Promise<void> {
  const existing = (await readArtifact(projectPath, collectionsArtifact)).data;
  const collection = existing.collections[0];
  if (collection === undefined) throw new Error("fixture has no collections");
  await writeArtifact(projectPath, collectionsArtifact, {
    provenance: "ai",
    data: {
      collections: [
        {
          ...collection,
          template: [
            { sectionId: "hero", itemFields: ["title"] },
            { sectionId: "body", itemFields: ["title"] },
          ],
        },
      ],
    },
  });
  await stageSection(projectPath, "body", "Body");
}

describe("runScaffold richtext wrappers", () => {
  it("stages the richtext/ subdir alongside every Component.tsx it copies", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "scaffold-richtext-"));
    await buildMinimalScaffoldFixture(projectPath);

    await stageWrapper(synthEntryDir(projectPath, "globals", "footer"), "body", wrapper("32px"));
    await stageWrapper(sectionSynthDir(projectPath, "hero"), "body", wrapper("32px"));

    const result = await runScaffold({ projectPath });

    expect(result.files).toContain("src/globals/Footer/richtext/body.tsx");
    expect(result.files).toContain("src/detail/works/sections/richtext/body.tsx");
    expect(result.warnings.filter((w) => w.includes("richtext"))).toEqual([]);

    const staged = await readFile(join(projectPath, "src/globals/Footer/richtext/body.tsx"), "utf8");
    expect(staged).toContain("export default function RichTextBody(");
    expect(staged).toContain("[&_h2]:[font-size:32px]");
    // Passed through rewriteRelativeTsImports like Component.tsx is.
    expect(staged).toContain('from "./props"');
    expect(staged).not.toContain('from "./props.tsx"');
  });

  it("warns when two sections of one collection stage different wrappers for the same slug", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "scaffold-richtext-clash-"));
    await buildMinimalScaffoldFixture(projectPath);
    await useTwoSections(projectPath);

    await stageWrapper(sectionSynthDir(projectPath, "hero"), "body", wrapper("32px"));
    await stageWrapper(sectionSynthDir(projectPath, "body"), "body", wrapper("48px"));

    const result = await runScaffold({ projectPath });

    expect(result.warnings.some((w) => w.includes("richtext") && w.includes("body"))).toBe(true);
  });

  it("does not warn when two sections stage identical wrappers for the same slug", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "scaffold-richtext-same-"));
    await buildMinimalScaffoldFixture(projectPath);
    await useTwoSections(projectPath);

    await stageWrapper(sectionSynthDir(projectPath, "hero"), "body", wrapper("32px"));
    await stageWrapper(sectionSynthDir(projectPath, "body"), "body", wrapper("32px"));

    const result = await runScaffold({ projectPath });

    expect(result.warnings.filter((w) => w.includes("richtext"))).toEqual([]);
  });
});
