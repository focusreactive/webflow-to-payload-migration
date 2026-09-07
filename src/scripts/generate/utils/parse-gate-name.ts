import { CliUsageError } from "#lib/cli/index.ts";

import { GATE_NAMES, type GateName } from "../constants/ids.ts";

export function parseGateName(raw: string): GateName {
  if ((GATE_NAMES as readonly string[]).includes(raw)) return raw as GateName;
  throw new CliUsageError(`--gate must be one of: ${GATE_NAMES.join(", ")}`);
}
