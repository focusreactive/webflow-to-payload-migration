import { mintBlockTypeId } from "#ir/block-type-id.ts";
import { collectionIdSchema, type BlockTypeId } from "#ir/common.ts";
import type { BlocksShardData, DiscoveryBlocksData } from "#ir/discovery.ts";

import type { DedupResponse } from "../../schemas/dedup-response.ts";

import { instanceKey } from "./utils/fold-dedup.ts";

export function foldDedup(args: { response: DedupResponse; shards: BlocksShardData[] }): DiscoveryBlocksData {
  const minted: BlockTypeId[] = [];

  const nodeIdsByInstance = new Map<string, string[]>();
  for (const shard of args.shards) {
    for (const instance of shard.instances) {
      nodeIdsByInstance.set(instanceKey(instance.route, instance.nodeIds), instance.nodeIds);
    }
  }

  const types = args.response.types.map((type) => {
    const id = mintBlockTypeId(type.role, minted);
    minted.push(id);
    const nodeIds = nodeIdsByInstance.get(instanceKey(type.exemplar.route, [type.exemplar.nodeId]));

    return {
      id,
      name: type.name,
      role: type.role,
      exemplar: {
        route: type.exemplar.route,
        nodeIds: nodeIds ?? [type.exemplar.nodeId],
      },
      ...(type.collectionKey !== null ? { collectionKey: collectionIdSchema.parse(type.collectionKey) } : {}),
    };
  });

  return { types };
}
