import { readFile, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeAppEnv } from "#generate/steps/scaffold/app-env.ts";

describe("writeAppEnv", () => {
  it("writes a four-line sqlite env at the project root", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "env-"));
    await writeAppEnv({ projectPath, projectName: "acme-site" });

    const env = await readFile(join(projectPath, ".env"), "utf8");
    expect(env).toContain("DATABASE_URI=file:./payload.db");
    expect(env).toMatch(/PAYLOAD_SECRET=[0-9a-f]{64}/);
    expect(env).toContain("PAYLOAD_ADMIN_EMAIL=admin@example.com");
    expect(env).toMatch(/PAYLOAD_ADMIN_PASSWORD=[0-9a-f]{32}/);
  });

  it("carries nothing from the private infrastructure the public tool dropped", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "env-"));
    await writeAppEnv({ projectPath, projectName: "acme-site" });

    const env = await readFile(join(projectPath, ".env"), "utf8");
    for (const key of ["OPENAI_API_KEY", "CRON_SECRET", "PREVIEW_SECRET", "NEXT_PUBLIC_SERVER_URL", "postgres"]) {
      expect(env).not.toContain(key);
    }
  });

  it("never overwrites an existing env", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "env-"));
    await writeFile(join(projectPath, ".env"), "KEEP=1");

    await writeAppEnv({ projectPath, projectName: "acme-site" });

    expect(await readFile(join(projectPath, ".env"), "utf8")).toBe("KEEP=1");
  });
});
