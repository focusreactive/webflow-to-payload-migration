import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GateFindingsError } from "#generate/gates.ts";
import { parseGateName, runGates, type GateOutput } from "#generate/index.ts";
import { LINT_FINDINGS_ARTIFACT_PATH } from "#generate/paths.ts";
import { initManifest } from "#lib/manifest/index.ts";

describe("parseGateName", () => {
  it("accepts valid gate names from GATE_NAMES", () => {
    expect(parseGateName("install")).toBe("install");
    expect(parseGateName("types")).toBe("types");
    expect(parseGateName("build")).toBe("build");
  });

  it("rejects invalid gate names", () => {
    expect(() => parseGateName("invalid")).toThrow(/--gate must be one of:/);
  });
});

async function project(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "index-gates-"));
  await mkdir(join(dir, ".migration"), { recursive: true });
  await initManifest(dir, { toolVersion: "0.1.0", sourceUrl: "https://example.com" });
  return dir;
}

// Captured, not printed: what the stage reports is worth asserting, and a passing suite should
// say nothing.
function capturedOutput(): GateOutput & { logs: string[]; warnings: string[] } {
  const logs: string[] = [];
  const warnings: string[] = [];
  return { logs, warnings, log: (line) => logs.push(line), warn: (line) => warnings.push(line) };
}

describe("runGates", () => {
  it("writes the findings artifact when a gate passes with findings", async () => {
    const projectPath = await project();

    const output = capturedOutput();
    await runGates({
      projectPath,
      gates: ["lint"],
      force: false,
      runGateFn: () => Promise.resolve({ ok: true, findings: "Found 3 warnings and 0 errors." }),
      output,
    });

    expect(output.logs).toEqual(["lint: ok"]);
    expect(output.warnings).toEqual([]);
    const artifact = await readFile(join(projectPath, LINT_FINDINGS_ARTIFACT_PATH), "utf8");
    expect(artifact).toContain("## lint");
    expect(artifact).toContain("Found 3 warnings and 0 errors.");
  });

  it("writes the findings artifact before rethrowing when a gate fails with GateFindingsError", async () => {
    const projectPath = await project();

    await expect(
      runGates({
        projectPath,
        gates: ["lint"],
        force: false,
        runGateFn: () =>
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
    // Pre-occupy the artifact path with a directory so writeFileAtomic's rename fails: the
    // finally block's own write error must not shadow the gate error that triggered it.
    await mkdir(join(projectPath, LINT_FINDINGS_ARTIFACT_PATH), { recursive: true });

    const output = capturedOutput();
    await expect(
      runGates({
        projectPath,
        gates: ["lint", "build"],
        force: false,
        runGateFn: (opts) =>
          opts.gate === "lint" ?
            Promise.resolve({ ok: true, findings: "Found 3 warnings and 0 errors." })
          : Promise.reject(new Error("build gate crashed")),
        output,
      }),
    ).rejects.toThrow(/build gate crashed/);

    // The write failure is reported, not swallowed — and it did not replace the gate error.
    expect(output.warnings).toHaveLength(1);
    expect(output.warnings[0]).toMatch(/failed to write lint findings artifact: EISDIR/);
  });

  it("does not write the artifact when no gate produces findings", async () => {
    const projectPath = await project();

    await runGates({
      projectPath,
      gates: ["build"],
      force: false,
      runGateFn: () => Promise.resolve({ ok: true }),
      output: capturedOutput(),
    });

    await expect(readFile(join(projectPath, LINT_FINDINGS_ARTIFACT_PATH), "utf8")).rejects.toThrow();
  });
});
