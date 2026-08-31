import { existsSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assertLayerSeams, createOverlayDraft, writeOverlay } from "#generate/overlay.ts";

async function projectWith(files: string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "overlay-"));
  for (const file of files) {
    await mkdir(join(dir, file, ".."), { recursive: true });
    await writeFile(join(dir, file), "laid");
  }
  return dir;
}

describe("assertLayerSeams", () => {
  it("rejects emission that lands on a file no earlier run of this tool wrote", async () => {
    const projectPath = await projectWith(["src/collections/Media.ts"]);
    const { draft, templates, emitted } = createOverlayDraft();
    draft.emit("src/collections/Media.ts", "ours");

    expect(() => assertLayerSeams({ projectPath, templates, emitted, previouslyWritten: [] })).toThrow(/Media\.ts/);
  });

  it("allows re-emitting a file this stage wrote on a previous run", async () => {
    const projectPath = await projectWith(["src/blocks/hero/config.ts"]);
    const { draft, templates, emitted } = createOverlayDraft();
    draft.emit("src/blocks/hero/config.ts", "ours");

    expect(() =>
      assertLayerSeams({
        projectPath,
        templates,
        emitted,
        previouslyWritten: ["src/blocks/hero/config.ts"],
      }),
    ).not.toThrow();
  });

  // A file-existence check only sees collisions that land on the same path; Next's route
  // resolution collides on the URL, and an optional catch-all also claims the URL one level up.
  it("rejects an emitted route that claims a URL another route file already owns", async () => {
    const projectPath = await projectWith(["src/app/(frontend)/page.tsx"]);
    const { draft, templates, emitted } = createOverlayDraft();
    draft.emit("src/app/(frontend)/[[...slug]]/page.tsx", "ours");

    expect(() => assertLayerSeams({ projectPath, templates, emitted, previouslyWritten: [] })).toThrow(
      /two route files claim the same URL/,
    );
  });

  it("accepts a migrated detail route alongside the shell's catch-all, admin and api routes", async () => {
    const projectPath = await projectWith([
      "src/app/(frontend)/[[...slug]]/page.tsx",
      "src/app/(payload)/admin/[[...segments]]/page.tsx",
      "src/app/(payload)/api/[...slug]/route.ts",
      "src/app/(payload)/api/graphql/route.ts",
    ]);
    const { draft, templates, emitted } = createOverlayDraft();
    draft.emit("src/app/(frontend)/works/[slug]/page.tsx", "ours");

    expect(() => assertLayerSeams({ projectPath, templates, emitted, previouslyWritten: [] })).not.toThrow();
  });

  // A previous run's route file is still on disk when this check runs (writeOverlay deletes it
  // immediately after), so it must not be counted as a claimant — otherwise renaming a
  // collection's slug field fails the stage against its own leftovers.
  it("ignores a stale route file this run no longer writes", async () => {
    const projectPath = await projectWith(["src/app/(frontend)/works/[slug]/page.tsx"]);
    const { draft, templates, emitted } = createOverlayDraft();
    draft.emit("src/app/(frontend)/works/[id]/page.tsx", "ours");

    expect(() =>
      assertLayerSeams({
        projectPath,
        templates,
        emitted,
        previouslyWritten: ["src/app/(frontend)/works/[slug]/page.tsx"],
      }),
    ).not.toThrow();
  });
});

describe("writeOverlay", () => {
  it("writes both layers and deletes files this stage no longer emits", async () => {
    const projectPath = await projectWith(["src/payload.config.ts", "src/blocks/old-hero/config.ts"]);
    const { draft, templates, emitted } = createOverlayDraft();
    draft.template("src/payload.config.ts", "ours");
    draft.emit("src/blocks/hero/config.ts", "ours");

    const result = await writeOverlay({
      projectPath,
      templates,
      emitted,
      previouslyWritten: ["src/blocks/old-hero/config.ts"],
    });

    expect(existsSync(join(projectPath, "src/blocks/hero/config.ts"))).toBe(true);
    expect(existsSync(join(projectPath, "src/blocks/old-hero/config.ts"))).toBe(false);
    expect(result.removed).toEqual(["src/blocks/old-hero/config.ts"]);
    expect(result.files).toEqual(["src/blocks/hero/config.ts", "src/payload.config.ts"]);
  });

  it("keeps a file this run writes again, however the previous run listed it", async () => {
    const projectPath = await projectWith(["src/payload.config.ts"]);
    const { draft, templates, emitted } = createOverlayDraft();
    draft.template("src/payload.config.ts", "ours");

    const result = await writeOverlay({
      projectPath,
      templates,
      emitted,
      previouslyWritten: ["src/payload.config.ts"],
    });

    expect(existsSync(join(projectPath, "src/payload.config.ts"))).toBe(true);
    expect(result.removed).toEqual([]);
  });
});
