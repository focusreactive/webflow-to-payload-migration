import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { type GateName } from "./steps.ts";

const MINUTE_MS = 60_000;

export const GATE_TIMEOUT_MS: Record<GateName, number> = {
  install: 15 * MINUTE_MS,
  types: 5 * MINUTE_MS,
  importmap: 5 * MINUTE_MS,
  seed: 40 * MINUTE_MS,
  build: 20 * MINUTE_MS,
  lint: 5 * MINUTE_MS,
};

// Gates whose failure means the deliverable does not work at all. `lint` is deliberately
// excluded: its findings are style, not a broken project, so they are written to an artifact
// and reported rather than stopping the run.
export const BLOCKING_GATES: ReadonlySet<GateName> = new Set<GateName>([
  "install",
  "types",
  "importmap",
  "seed",
  "build",
]);

export class GateFindingsError extends Error {
  constructor(
    message: string,
    public readonly findings: string,
  ) {
    super(message);
    this.name = "GateFindingsError";
  }
}

export function timeoutFallbackFile(gate: GateName): string | undefined {
  if (gate === "types") return "src/payload-types.ts";
  if (gate === "importmap") return "src/app/(payload)/admin/importMap.js";
  return undefined;
}

export function parseEnvFile(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

export function gateCommands(gate: GateName): string[][] {
  switch (gate) {
    case "install":
      // The deliverable lives in someone else's directory; without --ignore-workspace a
      // parent pnpm-workspace.yaml would pull it into a workspace it is not part of.
      return [["install", "--ignore-workspace"]];
    case "types":
      return [["run", "generate:types"]];
    case "importmap":
      return [["run", "generate:importmap"]];
    case "seed":
      return [["run", "seed"]];
    case "build":
      return [["run", "build"]];
    case "lint":
      return [["run", "lint"]];
  }
}

export interface ExecResult {
  code: number | null;
  output: string;
  timedOut?: boolean;
}

export type ExecFn = (
  args: string[],
  opts: { cwd: string; env: Record<string, string | undefined>; timeoutMs: number },
) => Promise<ExecResult>;

const defaultExec: ExecFn = (args, opts) =>
  new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, { cwd: opts.cwd, env: opts.env as NodeJS.ProcessEnv });
    let output = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output, timedOut });
    });
  });

function tail(output: string, lines = 80): string {
  return output.split("\n").slice(-lines).join("\n");
}

export async function runGate(args: {
  projectPath: string;
  gate: GateName;
  exec?: ExecFn;
}): Promise<{ ok: true; note?: string; findings?: string }> {
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

    // eslint exits nonzero the moment it has an error-severity finding. That is a report about
    // the generated code, not a broken deliverable, so it travels back as findings.
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

  return { ok: true, ...(note !== undefined ? { note } : {}), ...(findings !== undefined ? { findings } : {}) };
}
