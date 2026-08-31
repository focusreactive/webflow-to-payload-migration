import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readToolVersion(rootDir: string): string {
  const packageJsonPath = join(rootDir, "package.json");

  let raw: { version?: string };
  try {
    raw = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  } catch (error) {
    throw new Error(`Failed to read tool package.json at ${packageJsonPath}`, { cause: error });
  }

  if (typeof raw.version !== "string" || raw.version === "") {
    throw new Error(`${packageJsonPath} is missing a "version" field`);
  }

  return raw.version;
}
