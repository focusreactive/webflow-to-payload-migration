import { CliUsageError, parseServiceArgs } from "#lib/cli/index.ts";

import { runDetect } from "./detect.ts";

function main(): Promise<void> {
  const { projectPath, force } = parseServiceArgs(process.argv.slice(2));

  return runDetect(projectPath, force);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(error instanceof CliUsageError ? error.exitCode : 1);
}
