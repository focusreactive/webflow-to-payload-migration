import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GENERATE_SCAFFOLD_STEP_ID } from "#generate/constants/ids.ts";
import { runScaffold } from "#generate/steps/scaffold/scaffold.ts";
import { readManifest } from "#lib/manifest/index.ts";

import { buildMinimalScaffoldFixture } from "../../fixtures/minimal-scaffold.ts";

async function capture(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (line: string) => lines.push(line);
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return lines;
}

describe("runScaffold", () => {
  it("emits the deliverable, marks the step done and reports the file count", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "scaffold-step-"));
    await buildMinimalScaffoldFixture(projectPath);

    const lines = await capture(() => runScaffold({ projectPath, force: false }));

    const printed: unknown = JSON.parse(lines[0] as string);
    expect(printed).toMatchObject({ step: GENERATE_SCAFFOLD_STEP_ID, status: "done" });
    expect((printed as { files: number }).files).toBeGreaterThan(0);
    expect((printed as { warnings: string[] }).warnings).toEqual([
      "fonts: snapshot fonts.css missing or empty — app ships without webfonts",
    ]);

    const manifest = await readManifest(projectPath);
    expect(manifest.steps[GENERATE_SCAFFOLD_STEP_ID]?.status).toBe("done");
    expect(await readFile(join(projectPath, "package.json"), "utf8")).toContain('"payload"');
  });

  it("prints skipped and writes nothing on a repeat run", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "scaffold-step-repeat-"));
    await buildMinimalScaffoldFixture(projectPath);

    await capture(() => runScaffold({ projectPath, force: false }));
    const lines = await capture(() => runScaffold({ projectPath, force: false }));

    expect(lines).toEqual([JSON.stringify({ step: GENERATE_SCAFFOLD_STEP_ID, status: "skipped" })]);
  });

  it("re-emits under --force", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "scaffold-step-force-"));
    await buildMinimalScaffoldFixture(projectPath);

    await capture(() => runScaffold({ projectPath, force: false }));
    const lines = await capture(() => runScaffold({ projectPath, force: true }));

    expect(JSON.parse(lines[0] as string)).toMatchObject({ status: "done" });
  });
});
