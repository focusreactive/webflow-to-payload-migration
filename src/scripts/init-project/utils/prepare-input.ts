import { readFileSync } from "node:fs";

import type { BuildRunConfigInput } from "#init-project/steps/prepare/build-run-config.ts";

import { type InitArgs } from "./parse-init-args.ts";
import { requireStringFromFlag } from "./require-string-from-flag.ts";

export function prepareInput(values: InitArgs): BuildRunConfigInput {
  const projectName = values["project-name"];
  const workspacePath = values["workspace-path"];
  const fileConfig = readFileConfig(values["run-config"]);

  return {
    url: requireStringFromFlag(values["url"], "--url"),
    ...(projectName !== undefined ? { projectName } : {}),
    ...(workspacePath !== undefined ? { workspacePath } : {}),
    ...(fileConfig !== undefined ? { fileConfig } : {}),
  };
}

function readFileConfig(path: string | undefined): BuildRunConfigInput["fileConfig"] {
  if (path === undefined) return undefined;

  try {
    return JSON.parse(readFileSync(path, "utf8")) as BuildRunConfigInput["fileConfig"];
  } catch (error) {
    throw new Error(`Failed to read --run-config file at ${path}`, { cause: error });
  }
}
