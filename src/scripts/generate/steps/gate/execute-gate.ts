import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { GATE_TIMEOUT_MS } from "../../constants/gates.ts";
import { type GateName } from "../../constants/ids.ts";

import {
  defaultExec,
  gateCommands,
  parseEnvFile,
  tail,
  timeoutFallbackFile,
  type ExecFn,
} from "./utils/execute-gate.ts";

export class GateFindingsError extends Error {
  constructor(
    message: string,
    public readonly findings: string,
  ) {
    super(message);
    this.name = "GateFindingsError";
  }
}

export interface GateOutcome {
  note?: string;
  findings?: string;
}

export async function executeGate(args: { projectPath: string; gate: GateName; exec?: ExecFn }): Promise<GateOutcome> {
  const exec = args.exec ?? defaultExec;
  const envFile = join(args.projectPath, ".env");
  const fileEnv = existsSync(envFile) ? parseEnvFile(await readFile(envFile, "utf8")) : {};
  const env = { ...process.env, ...fileEnv };
  let note: string | undefined;
  let findings: string | undefined;

  for (const command of gateCommands(args.gate)) {
    const result = await exec(command, {
      cwd: args.projectPath,
      env,
      timeoutMs: GATE_TIMEOUT_MS[args.gate],
    });

    if (result.timedOut === true) {
      const fallback = timeoutFallbackFile(args.gate);
      if (fallback !== undefined && existsSync(join(args.projectPath, fallback))) {
        note = `pnpm ${command.join(" ")} timed out but ${fallback} exists — treated as success`;
        continue;
      }
      throw new Error(`gate ${args.gate}: pnpm ${command.join(" ")} timed out\n${tail(result.output)}`);
    }

    if (args.gate === "lint") {
      if (result.code !== 0 && result.output.trim() !== "") findings = tail(result.output);
      continue;
    }

    if (result.code !== 0) {
      throw new Error(
        `gate ${args.gate}: pnpm ${command.join(" ")} exited ${String(result.code)}\n${tail(result.output)}`,
      );
    }
  }

  return { ...(note !== undefined ? { note } : {}), ...(findings !== undefined ? { findings } : {}) };
}
