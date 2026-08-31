import { parseArgs } from "node:util";

import { CliUsageError } from "#lib/cli/index.ts";

import { USAGE } from "../constants/usage.ts";

const OPTIONS = {
  prepare: { type: "boolean" },
  init: { type: "boolean" },
  url: { type: "string" },
  "project-name": { type: "string" },
  "workspace-path": { type: "string" },
  "run-config": { type: "string" },
  help: { type: "boolean" },
} as const;

export function parseInitArgs(argv: string[]) {
  try {
    const { values } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: false });

    return values;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new CliUsageError(`${reason}\n${USAGE}`);
  }
}

export type InitArgs = ReturnType<typeof parseInitArgs>;
