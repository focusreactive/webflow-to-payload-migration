import { CliUsageError, parseServiceArgs } from "#lib/cli/index.ts";

import { runInventory } from "./inventory.ts";

function main(): Promise<void> {
  const args = parseServiceArgs(process.argv.slice(2));

  return runInventory(args.projectPath, args.force);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(error instanceof CliUsageError ? error.exitCode : 1);
}
