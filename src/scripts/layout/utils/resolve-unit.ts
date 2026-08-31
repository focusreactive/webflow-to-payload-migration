import { CliUsageError } from "#lib/cli/index.ts";

import type { LayoutStaticUnit } from "../types.ts";

export function resolveUnit(units: LayoutStaticUnit[], route: string): LayoutStaticUnit {
  const unit = units.find((entry) => entry.route === route);
  if (unit === undefined) {
    throw new CliUsageError(`unknown layout unit: static "${route}" (see --state)`);
  }
  return unit;
}
