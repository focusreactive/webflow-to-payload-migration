import { join } from "node:path";

import { writeFileAtomic } from "#lib/fs.ts";
import { readManifest, withStep } from "#lib/manifest/index.ts";

import { generateGateStepId, type GateName } from "../../constants/ids.ts";
import { LINT_FINDINGS_ARTIFACT_PATH } from "../../constants/paths.ts";

import { executeGate, GateFindingsError, type GateOutcome } from "./execute-gate.ts";

export interface GateOutput {
  log: (line: string) => void;
  warn: (line: string) => void;
}

const processOutput: GateOutput = {
  log: (line) => process.stdout.write(`${line}\n`),
  warn: (line) => process.stderr.write(`${line}\n`),
};

export async function runGate(opts: {
  projectPath: string;
  gate: GateName;
  force: boolean;
  executeGateFn?: typeof executeGate;
  output?: GateOutput;
}): Promise<void> {
  const executeGateFn = opts.executeGateFn ?? executeGate;
  const output = opts.output ?? processOutput;
  const stepId = generateGateStepId(opts.gate);
  const manifest = await readManifest(opts.projectPath);
  const wasSkipped = manifest.steps[stepId]?.status === "done" && !opts.force;
  let findings: string | undefined;

  try {
    let outcome: GateOutcome | undefined;
    try {
      outcome = await withStep(
        opts.projectPath,
        stepId,
        () => executeGateFn({ projectPath: opts.projectPath, gate: opts.gate }),
        { force: opts.force },
      );
      findings = outcome?.findings;
    } catch (error) {
      if (error instanceof GateFindingsError) findings = error.findings;
      throw error;
    }

    if (wasSkipped || outcome === undefined) {
      output.log(JSON.stringify({ step: stepId, status: "skipped" }));
      return;
    }

    output.log(
      JSON.stringify({
        step: stepId,
        status: "done",
        ...(outcome.note !== undefined ? { note: outcome.note } : {}),
        ...(outcome.findings !== undefined ? { findings: LINT_FINDINGS_ARTIFACT_PATH } : {}),
      }),
    );
  } finally {
    if (findings !== undefined) {
      try {
        await writeFileAtomic(join(opts.projectPath, LINT_FINDINGS_ARTIFACT_PATH), `## ${opts.gate}\n${findings}\n`);
      } catch (writeError) {
        const message = writeError instanceof Error ? writeError.message : String(writeError);
        output.warn(`warning: failed to write ${opts.gate} findings artifact: ${message}`);
      }
    }
  }
}
