import { existsSync } from "node:fs";

import type { StitchIndexData } from "#ir/stitch.ts";
import { stitchIndexPath } from "#lib/stitch/paths.ts";

import type { GlobalsResponse } from "../../../schemas/globals-response.ts";
import type { AcceptError } from "../../../types.ts";

export function validateGlobalsResponse(args: {
  projectPath: string;
  response: GlobalsResponse;
  sourceStitch: StitchIndexData;
}): AcceptError[] {
  const errors: AcceptError[] = [];
  const knownMigIds = new Set(Object.keys(args.sourceStitch.elements));

  for (const [index, global] of args.response.globals.entries()) {
    const root = global.nodeIds[0]!;
    if (!knownMigIds.has(root)) {
      errors.push({
        code: "UNKNOWN_ID",
        where: `globals[${index}].nodeIds[0]`,
        got: root,
        detail: `Not a node of the source route ${args.response.source}.`,
        fix: "Use a data-mig-id that exists in the source route's stitch index.",
      });
    }
    for (const route of global.corroboratedRoutes) {
      if (existsSync(stitchIndexPath(args.projectPath, route))) continue;
      errors.push({
        code: "UNKNOWN_ROUTE",
        where: `globals[${index}].corroboratedRoutes`,
        got: route,
        detail: "No stitch index was captured for this route.",
        fix: "Name only routes listed as corroboration by the subject step.",
      });
    }
  }

  return errors;
}
