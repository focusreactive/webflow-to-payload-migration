import { readFileSync } from "node:fs";

export function readRunConfigFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read --run-config file at ${path}`, { cause: error });
  }
}
