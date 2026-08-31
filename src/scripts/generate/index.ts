import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { CliUsageError, parseServiceArgs } from "#lib/cli/index.ts";
import { writeFileAtomic } from "#lib/fs.ts";
import { readManifest, withStep } from "#lib/manifest/index.ts";

import { GateFindingsError, runGate } from "./gates.ts";
import { LINT_FINDINGS_ARTIFACT_PATH } from "./paths.ts";
import { planGenerateUnits } from "./plan.ts";
import { runScaffold } from "./scaffold.ts";
import { GATE_NAMES, GENERATE_SCAFFOLD_STEP_ID, generateGateStepId, type GateName } from "./steps.ts";

export function parseGateName(raw: string): GateName {
  if ((GATE_NAMES as readonly string[]).includes(raw)) return raw as GateName;
  throw new CliUsageError(`--gate must be one of: ${GATE_NAMES.join(", ")}`);
}

export async function runPlan(args: { projectPath: string }): Promise<void> {
  const manifest = await readManifest(args.projectPath);
  const units = planGenerateUnits({ manifest });

  process.stdout.write(JSON.stringify({ units }, null, 2) + "\n");
}

// Injectable so a test can assert on what the stage reported instead of printing it into a
// passing run's output.
export interface GateOutput {
  log: (line: string) => void;
  warn: (line: string) => void;
}

const processOutput: GateOutput = {
  log: (line) => process.stdout.write(`${line}\n`),
  warn: (line) => process.stderr.write(`${line}\n`),
};

// Non-blocking gates (currently only `lint`) can still carry findings worth persisting even
// when they stop the run outright — the `finally` guarantees the artifact lands either way, so
// the findings stay readable in .migration/artifacts/generate/lint.txt whichever happened.
export async function runGates(opts: {
  projectPath: string;
  gates: readonly GateName[];
  force: boolean;
  runGateFn?: typeof runGate;
  output?: GateOutput;
}): Promise<void> {
  const runGateFn = opts.runGateFn ?? runGate;
  const output = opts.output ?? processOutput;
  const findings: string[] = [];
  try {
    for (const gate of opts.gates) {
      try {
        const result = await withStep(
          opts.projectPath,
          generateGateStepId(gate),
          () => runGateFn({ projectPath: opts.projectPath, gate }),
          { force: opts.force },
        );
        output.log(`${gate}: ${result === undefined ? "skipped (done)" : (result.note ?? "ok")}`);
        if (result?.findings !== undefined) findings.push(`## ${gate}\n${result.findings}`);
      } catch (error) {
        if (error instanceof GateFindingsError) findings.push(`## ${gate}\n${error.findings}`);
        throw error;
      }
    }
  } finally {
    if (findings.length > 0) {
      // A write failure here must not replace whatever the try block already threw (or is
      // about to return cleanly) — a JS `finally` throw always wins over the try block's own
      // outcome, so losing the real gate error to an artifact-write failure would hide it.
      try {
        await writeFileAtomic(join(opts.projectPath, LINT_FINDINGS_ARTIFACT_PATH), `${findings.join("\n\n")}\n`);
      } catch (writeError) {
        const message = writeError instanceof Error ? writeError.message : String(writeError);
        output.warn(`warning: failed to write lint findings artifact: ${message}`);
      }
    }
  }
}

async function main(): Promise<void> {
  const args = parseServiceArgs(process.argv.slice(2), {
    extraFlags: {
      plan: { type: "boolean" },
      scaffold: { type: "boolean" },
      gates: { type: "boolean" },
      gate: { type: "string" },
    },
  });

  if (args["plan"] === true) {
    await runPlan({ projectPath: args.projectPath });
  } else if (args["scaffold"] === true) {
    await withStep(
      args.projectPath,
      GENERATE_SCAFFOLD_STEP_ID,
      async () => {
        const result = await runScaffold({ projectPath: args.projectPath });
        process.stdout.write(JSON.stringify({ files: result.files.length, warnings: result.warnings }, null, 2) + "\n");
      },
      { force: args.force },
    );
  } else if (args["gates"] === true || typeof args["gate"] === "string") {
    const requested: GateName[] = typeof args["gate"] === "string" ? [parseGateName(args["gate"])] : [...GATE_NAMES];
    await runGates({ projectPath: args.projectPath, gates: requested, force: args.force });
  } else {
    throw new CliUsageError("one of --plan | --scaffold | --gates | --gate is required");
  }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(error instanceof CliUsageError ? error.exitCode : 1);
  }
}
