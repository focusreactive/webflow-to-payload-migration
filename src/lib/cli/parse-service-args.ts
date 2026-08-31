import { parseArgs } from "node:util";
import { CliUsageError } from "./usage-error.ts";

export interface ServiceArgs {
  projectPath: string;
  force: boolean;
}

type ExtraFlags = Record<string, { type: "string" | "boolean" }>;

interface Options {
  extraFlags?: ExtraFlags;
}

type Result = ServiceArgs & Record<string, string | boolean | undefined>;

export function parseServiceArgs(argv: string[], opts?: Options): Result {
  const extraFlags = opts?.extraFlags ?? {};
  const usage = usageText(extraFlags);

  let values: Record<string, string | boolean | (string | boolean)[] | undefined>;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        project: { type: "string" },
        force: { type: "boolean" },
        help: { type: "boolean" },
        ...extraFlags,
      },
      allowPositionals: false,
    }));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new CliUsageError(`${reason}\n${usage}`);
  }

  if (values["help"] === true) throw new CliUsageError(usage);

  const project = values["project"];
  if (typeof project !== "string" || project === "") {
    throw new CliUsageError(`--project is required\n${usage}`);
  }

  const extras: Record<string, string | boolean | undefined> = {};
  for (const name of Object.keys(extraFlags)) {
    const value = values[name];
    if (typeof value === "string" || typeof value === "boolean") {
      extras[name] = value;
    }
  }

  return {
    ...extras,
    projectPath: project,
    force: values["force"] === true,
  };
}

function usageText(extraFlags: ExtraFlags): string {
  const extraUsage = Object.entries(extraFlags)
    .map(([name, def]) => (def.type === "string" ? ` [--${name} <value>]` : ` [--${name}]`))
    .join("");

  return `Usage: tsx <service> --project <path> [--force]${extraUsage} [--help]`;
}
