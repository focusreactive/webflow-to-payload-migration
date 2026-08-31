import type { BlockType } from "#ir/blocks.ts";

import type { AcceptError, LayoutPayload } from "../../types.ts";

export function validateLayoutPayload(opts: {
  payload: LayoutPayload;
  knownMigIds: ReadonlySet<string>;
  blocksById: Map<string, BlockType>;
}): AcceptError[] {
  const errors: AcceptError[] = [];
  const seenAnchors = new Set<string>();

  opts.payload.blocks.forEach((instance, index) => {
    if (!opts.knownMigIds.has(instance.anchorMigId)) {
      errors.push({
        code: "UNKNOWN_ANCHOR",
        where: `blocks.${index}.anchorMigId`,
        got: instance.anchorMigId,
        detail: "this migId is not in the unit's captures",
        fix: "Use the data-mig-id of the section root as it appears in the unit's rendered HTML.",
      });
    }
    if (seenAnchors.has(instance.anchorMigId)) {
      errors.push({
        code: "DUPLICATE_ANCHOR",
        where: `blocks.${index}.anchorMigId`,
        got: instance.anchorMigId,
        detail: "another instance already anchors here",
        fix: "One record per section instance — anchor every instance at its own section root.",
      });
    }
    seenAnchors.add(instance.anchorMigId);

    if (!opts.blocksById.has(instance.blockType)) {
      errors.push({
        code: "UNKNOWN_BLOCK_TYPE",
        where: `blocks.${index}.blockType`,
        got: instance.blockType,
        expected: [...opts.blocksById.keys()],
        fix: "Use a block type id from the vocabulary the subject step printed.",
      });
    }
  });

  return errors;
}
