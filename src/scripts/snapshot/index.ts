import { CliUsageError, parseServiceArgs } from "#lib/cli/index.ts";

import { runRefreshSnapshot } from "./refresh-snapshot.ts";
import { runSnapshot } from "./snapshot.ts";

function main(): Promise<void> {
  const args = parseServiceArgs(process.argv.slice(2), {
    extraFlags: { refresh: { type: "boolean" } },
  });

  if (args["refresh"] === true) return runRefreshSnapshot(args.projectPath);

  return runSnapshot(args.projectPath, args.force);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(`${message}\n`);
  process.exit(error instanceof CliUsageError ? error.exitCode : 1);
}
