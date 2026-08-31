import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { loadUnits } from "../../utils/load-units.ts";
import { printJson } from "../../utils/print-json.ts";
import { resolveUnit } from "../../utils/resolve-unit.ts";

import { assembleUnitSubject } from "./assemble-unit-subject.ts";

export async function runSubject(projectPath: string, route: string): Promise<void> {
  const unit = resolveUnit(await loadUnits(projectPath), route);
  const subject = await assembleUnitSubject(projectPath, unit);

  await mkdir(dirname(subject.responsePath), { recursive: true });

  printJson(subject);
}
