import { spawn } from "node:child_process";

import { type GateName } from "../../../constants/ids.ts";

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

export const defaultExec: ExecFn = (args, opts) =>
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

export function tail(output: string, lines = 80): string {
  return output.split("\n").slice(-lines).join("\n");
}
