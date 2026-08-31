import { USAGE } from "#init-project/constants/usage.ts";
import { CliUsageError } from "#lib/cli/usage-error.ts";

export function requireStringFromFlag(value: string | undefined, flag: string): string {
  if (value === undefined || value === "") {
    throw new CliUsageError(`${flag} is required\n${USAGE}`);
  }

  return value;
}
