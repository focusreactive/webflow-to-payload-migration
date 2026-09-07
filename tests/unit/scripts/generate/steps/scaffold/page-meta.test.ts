import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPageTreeArtifact, readPageMeta } from "#generate/steps/scaffold/page-meta.ts";

async function projectWithPage(route: string, html: string): Promise<string> {
  const projectPath = await mkdtemp(join(tmpdir(), "page-meta-"));
  const dir = join(projectPath, ".migration/snapshot/pages", route === "/" ? "" : route.replace(/^\//, ""));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.html"), html);
  return projectPath;
}

describe("readPageMeta", () => {
  it("reads the title and the meta description from the snapshot", async () => {
    const projectPath = await projectWithPage(
      "/about",
      '<html><head><title>About Acme</title><meta name="description" content="Who we are"></head></html>',
    );

    expect(await readPageMeta({ projectPath, route: "/about" })).toEqual({
      title: "About Acme",
      description: "Who we are",
    });
  });

  it("returns nulls when the snapshot has no head metadata", async () => {
    const projectPath = await projectWithPage("/about", "<html><head></head></html>");

    expect(await readPageMeta({ projectPath, route: "/about" })).toEqual({ title: null, description: null });
  });

  it("returns nulls when the snapshot file is missing", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "page-meta-"));

    expect(await readPageMeta({ projectPath, route: "/gone" })).toEqual({ title: null, description: null });
  });
});

describe("buildPageTreeArtifact", () => {
  it("prefers the snapshot title for a captured route", async () => {
    const projectPath = await projectWithPage(
      "/about",
      '<html><head><title>About Acme</title><meta name="description" content="Who we are"></head></html>',
    );

    const nodes = await buildPageTreeArtifact({ projectPath, routes: ["/about"] });

    expect(nodes[0]).toMatchObject({
      path: "about",
      route: "/about",
      title: "About Acme",
      metaDescription: "Who we are",
    });
  });

  it("leaves a container node with the slug-derived title and no metadata", async () => {
    const projectPath = await projectWithPage("/team/about", "<html><head><title>About the team</title></head></html>");

    const nodes = await buildPageTreeArtifact({ projectPath, routes: ["/team/about"] });

    expect(nodes[0]).toMatchObject({ path: "team", route: null, title: "Team", metaTitle: null });
    expect(nodes[1]).toMatchObject({ path: "team/about", title: "About the team" });
  });
});
