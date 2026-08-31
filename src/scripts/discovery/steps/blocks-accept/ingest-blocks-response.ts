import type { BlockInstance, BlocksShardData } from "#ir/discovery.ts";
import type { StitchIndexData } from "#ir/stitch.ts";

import type { BlocksResponse } from "../../schemas/blocks-response.ts";
import { computeBoundaries } from "../../utils/compute-boundaries.ts";

export function ingestBlocksResponse(args: {
  response: BlocksResponse;
  route: string;
  stitchIndex: StitchIndexData;
}): BlocksShardData {
  const instances: BlockInstance[] = args.response.instances.map((instance) => ({
    route: args.route,
    nodeIds: instance.nodeIds,
    role: instance.role,
    summary: instance.summary,
    boundaries: computeBoundaries(instance.nodeIds, args.stitchIndex.elements),
  }));

  return { route: args.route, instances };
}
