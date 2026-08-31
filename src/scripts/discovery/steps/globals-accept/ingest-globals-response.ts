import { globalComponentId } from "#ir/globals.ts";
import type { DiscoveryGlobalsData } from "#ir/discovery.ts";

import type { GlobalsResponse } from "../../schemas/globals-response.ts";

export function ingestGlobalsResponse(args: { response: GlobalsResponse }): DiscoveryGlobalsData {
  const types = args.response.globals.map((global) => ({
    id: globalComponentId(global.name),
    name: global.name,
    exemplar: {
      route: args.response.source,
      nodeIds: global.nodeIds,
    },
  }));

  return { types };
}
