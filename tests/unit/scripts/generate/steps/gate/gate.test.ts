import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LINT_FINDINGS_ARTIFACT_PATH } from "#generate/constants/paths.ts";
import { GateFindingsError } from "#generate/steps/gate/execute-gate.ts";
import { runGate, type GateOutput } from "#generate/steps/gate/gate.ts";
import { initManifest } from "#lib/manifest/index.ts";

async function project(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "gate-"));
  await mkdir(join(dir, ".migration"), { recursive: true });
  await initManifest(dir, { toolVersion: "0.1.0", sourceUrl: "https://example.com" });
  return dir;
}

function capturedOutput(): GateOutput & { logs: string[]; warnings: string[] } {
  const logs: string[] = [];
  const warnings: string[] = [];
  return { logs, warnings, log: (line) => logs.push(line), warn: (line) => warnings.push(line) };
}

describe("runGate", () => {
  it("prints the step and its status, and records the step as done", async () => {
    const projectPath = await project();
    const output = capturedOutput();

    await runGate({
      projectPath,
      gate: "build",
      force: false,
      executeGateFn: () => Promise.resolve({}),
      output,
    });

    expect(output.logs).toEqual([JSON.stringify({ step: "generate:build", status: "done" })]);
  });

  it("prints skipped and re-runs nothing on a gate the manifest already has done", async () => {
    const projectPath = await project();
    let calls = 0;
    const output = capturedOutput();
    const executeGateFn = (): Promise<Record<string, never>> => {
      calls += 1;
      return Promise.resolve({});
    };

    await runGate({ projectPath, gate: "build", force: false, executeGateFn, output });
    await runGate({ projectPath, gate: "build", force: false, executeGateFn, output });

    expect(calls).toBe(1);
    expect(output.logs[1]).toBe(JSON.stringify({ step: "generate:build", status: "skipped" }));
  });

  it("re-runs a done gate under --force", async () => {
    const projectPath = await project();
    let calls = 0;
    const executeGateFn = (): Promise<Record<string, never>> => {
      calls += 1;
      return Promise.resolve({});
    };

    await runGate({ projectPath, gate: "build", force: false, executeGateFn, output: capturedOutput() });
    await runGate({ projectPath, gate: "build", force: true, executeGateFn, output: capturedOutput() });

    expect(calls).toBe(2);
  });

  it("carries the timeout-fallback note into the printed line", async () => {
    const projectPath = await project();
    const output = capturedOutput();

    await runGate({
      projectPath,
      gate: "types",
      force: false,
      executeGateFn: () => Promise.resolve({ note: "pnpm run generate:types timed out but … exists" }),
      output,
    });

    expect(output.logs[0]).toContain('"note"');
    expect(output.logs[0]).toContain("timed out");
  });

  it("writes the findings artifact when a gate passes with findings", async () => {
    const projectPath = await project();

    const output = capturedOutput();
    await runGate({
      projectPath,
      gate: "lint",
      force: false,
      executeGateFn: () => Promise.resolve({ findings: "Found 3 warnings and 0 errors." }),
      output,
    });

    expect(output.logs[0]).toContain(LINT_FINDINGS_ARTIFACT_PATH.replaceAll("\\", "\\\\"));
    expect(output.warnings).toEqual([]);
    const artifact = await readFile(join(projectPath, LINT_FINDINGS_ARTIFACT_PATH), "utf8");
    expect(artifact).toContain("## lint");
    expect(artifact).toContain("Found 3 warnings and 0 errors.");
  });

  it("writes the findings artifact before rethrowing when a gate fails with GateFindingsError", async () => {
    const projectPath = await project();

    await expect(
      runGate({
        projectPath,
        gate: "lint",
        force: false,
        executeGateFn: () =>
          Promise.reject(new GateFindingsError("gate lint: reported an error", "Found 0 warnings and 1 error.")),
        output: capturedOutput(),
      }),
    ).rejects.toBeInstanceOf(GateFindingsError);

    const artifact = await readFile(join(projectPath, LINT_FINDINGS_ARTIFACT_PATH), "utf8");
    expect(artifact).toContain("## lint");
    expect(artifact).toContain("Found 0 warnings and 1 error.");
  });

  it("propagates the original gate error even when the finally-block write itself fails", async () => {
    const projectPath = await project();
    await mkdir(join(projectPath, LINT_FINDINGS_ARTIFACT_PATH), { recursive: true });

    const output = capturedOutput();
    await expect(
      runGate({
        projectPath,
        gate: "lint",
        force: false,
        executeGateFn: () =>
          Promise.reject(new GateFindingsError("lint gate crashed", "Found 3 warnings and 0 errors.")),
        output,
      }),
    ).rejects.toThrow(/lint gate crashed/);

    expect(output.warnings).toHaveLength(1);
    expect(output.warnings[0]).toMatch(/failed to write lint findings artifact: EISDIR/);
  });

  it("does not write the artifact when the gate produces no findings", async () => {
    const projectPath = await project();

    await runGate({
      projectPath,
      gate: "build",
      force: false,
      executeGateFn: () => Promise.resolve({}),
      output: capturedOutput(),
    });

    await expect(readFile(join(projectPath, LINT_FINDINGS_ARTIFACT_PATH), "utf8")).rejects.toThrow();
  });
});
