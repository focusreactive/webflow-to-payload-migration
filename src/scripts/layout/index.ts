import { CliUsageError, parseServiceArgs } from "#lib/cli/index.ts";
import { readManifest } from "#lib/manifest/index.ts";

import { runAccept, runFinalize, runSchema, runState, runSubject } from "./steps/index.ts";
import { requireRoute } from "./utils/require-route.ts";

const FLAGS = ["state", "schema", "subject", "accept", "finalize"] as const;

async function main(): Promise<void> {
  const args = parseServiceArgs(process.argv.slice(2), {
    extraFlags: {
      ...Object.fromEntries(FLAGS.map((flag) => [flag, { type: "boolean" as const }])),
      route: { type: "string" },
    },
  });
  const projectPath = args.projectPath;

  await readManifest(projectPath);

  if (args["state"] === true) return runState(projectPath);
  if (args["schema"] === true) return runSchema(projectPath, requireRoute(args, "schema"));
  if (args["subject"] === true) return runSubject(projectPath, requireRoute(args, "subject"));
  if (args["accept"] === true) return runAccept(projectPath, requireRoute(args, "accept"));
  if (args["finalize"] === true) return runFinalize(projectPath, args.force);

  throw new CliUsageError(`one of ${FLAGS.map((flag) => `--${flag}`).join(" | ")} is required`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(`${message}\n`);
  process.exit(error instanceof CliUsageError ? error.exitCode : 1);
}
