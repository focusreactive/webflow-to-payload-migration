import { CliUsageError } from "#lib/cli/index.ts";

import { USAGE } from "./constants/usage.ts";
import { runInit, runPrepare } from "./steps/index.ts";
import { parseInitArgs } from "./utils/parse-init-args.ts";
import { requireStringFromFlag } from "./utils/require-string-from-flag.ts";
import { prepareInput } from "./utils/prepare-input.ts";

async function main(): Promise<void> {
  const values = parseInitArgs(process.argv.slice(2));

  if (values["help"] === true) throw new CliUsageError(USAGE);

  const prepare = values["prepare"] === true;
  const init = values["init"] === true;
  if (prepare === init) {
    throw new CliUsageError(`exactly one of --prepare|--init is required\n${USAGE}`);
  }

  if (prepare) return runPrepare(prepareInput(values));

  return runInit(requireStringFromFlag(values["run-config"], "--run-config"));
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(`${message}\n`);
  process.exit(error instanceof CliUsageError ? error.exitCode : 1);
}
