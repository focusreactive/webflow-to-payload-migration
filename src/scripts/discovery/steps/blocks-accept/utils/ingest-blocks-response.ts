import type { StitchIndexData } from "#ir/stitch.ts";
import { loadHtml } from "#lib/html.ts";

import type { BlocksResponse } from "../../../schemas/blocks-response.ts";
import type { AcceptError } from "../../../types.ts";

export function buildExcludedSet(html: string, excludeNodeIds: string[]): (nodeId: string) => boolean {
  const $ = loadHtml(html);
  const excluded = new Set<string>();

  for (const rootId of excludeNodeIds) {
    const root = $(`[data-mig-id="${rootId}"]`);
    if (root.length === 0) continue;
    excluded.add(rootId);
    root.find("[data-mig-id]").each((_, el) => {
      const id = $(el).attr("data-mig-id");
      if (id !== undefined) excluded.add(id);
    });
  }

  return (nodeId: string): boolean => excluded.has(nodeId);
}

export function validateBlocksResponse(args: {
  response: BlocksResponse;
  requestedRoute: string;
  stitchIndex: StitchIndexData;
  isExcluded: (nodeId: string) => boolean;
}): AcceptError[] {
  const errors: AcceptError[] = [];

  if (args.response.route !== args.requestedRoute) {
    errors.push({
      code: "ROUTE_MISMATCH",
      where: "route",
      got: args.response.route,
      detail: `The subject was served for ${args.requestedRoute}.`,
      fix: `Set route to "${args.requestedRoute}".`,
    });
  }

  const knownMigIds = new Set(Object.keys(args.stitchIndex.elements));
  for (const [index, instance] of args.response.instances.entries()) {
    const root = instance.nodeIds[0]!;
    if (!knownMigIds.has(root)) {
      errors.push({
        code: "UNKNOWN_ID",
        where: `instances[${index}].nodeIds[0]`,
        got: root,
        detail: `Not a node of ${args.requestedRoute}.`,
        fix: "Use a data-mig-id that exists in this route's stitch index.",
      });
    }
    if (args.isExcluded(root)) {
      errors.push({
        code: "EXCLUDED_CHROME",
        where: `instances[${index}].nodeIds[0]`,
        got: root,
        detail: "This node belongs to a global (header or footer).",
        fix: "Drop this instance — chrome is not a block.",
      });
    }
  }

  return errors;
}
