import type { BlocksShardData } from "#ir/discovery.ts";

import type { DedupResponse } from "../../../schemas/dedup-response.ts";
import type { AcceptError } from "../../../types.ts";

import { instanceKey } from "./fold-dedup.ts";

export function validateDedupResponse(args: { response: DedupResponse; shards: BlocksShardData[] }): AcceptError[] {
  const errors: AcceptError[] = [];
  const known = new Set(args.shards.flatMap((shard) => shard.instances.map((i) => instanceKey(i.route, i.nodeIds))));
  const covered = new Set<string>();

  for (const [index, type] of args.response.types.entries()) {
    for (const member of type.members) {
      const key = `${member.route}::${member.nodeId}`;
      if (!known.has(key)) {
        errors.push({
          code: "UNKNOWN_ID",
          where: `types[${index}].members`,
          got: key,
          detail: "No instance with this route and nodeId was listed by the subject step.",
          fix: "Use only the instances the subject printed.",
        });
        continue;
      }
      if (covered.has(key)) {
        errors.push({
          code: "DUPLICATE_ID",
          where: `types[${index}].members`,
          got: key,
          detail: "This instance belongs to more than one type.",
          fix: "Leave the instance in exactly one type.",
        });
      }
      covered.add(key);
    }

    const exemplarKey = `${type.exemplar.route}::${type.exemplar.nodeId}`;
    if (!type.members.some((member) => `${member.route}::${member.nodeId}` === exemplarKey)) {
      errors.push({
        code: "EXEMPLAR_NOT_MEMBER",
        where: `types[${index}].exemplar`,
        got: exemplarKey,
        detail: "The exemplar is not among this type's members.",
        fix: "Pick the exemplar from the type's own members.",
      });
    }
  }

  const missing = [...known].filter((key) => !covered.has(key));
  if (missing.length > 0) {
    errors.push({
      code: "INPUT_NOT_COVERED",
      where: "types",
      detail: `Instances left without a type: ${missing.join(", ")}`,
      fix: "Add each listed instance to a type.",
    });
  }

  return errors;
}
