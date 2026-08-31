import { CliUsageError } from "#lib/cli/index.ts";
import type { Vertical } from "#lib/synth-store/paths.ts";

import type { SynthVertical } from "../types.ts";

import { blocksVertical } from "./blocks.ts";
import { collectionsVertical } from "./collections.ts";
import { globalsVertical } from "./globals.ts";

const BY_ID: Record<Vertical, SynthVertical> = {
  blocks: blocksVertical,
  globals: globalsVertical,
  collections: collectionsVertical,
};

export const VERTICALS: readonly SynthVertical[] = [collectionsVertical, globalsVertical, blocksVertical];

export function verticalById(id: string): SynthVertical {
  const vertical = BY_ID[id as Vertical];
  if (vertical === undefined) {
    throw new CliUsageError(`--vertical must be one of collections | globals | blocks, got "${id}"`);
  }
  return vertical;
}

export function verticalByEntityFlag(flag: string): SynthVertical {
  const vertical = VERTICALS.find((candidate) => candidate.entityFlag === flag);
  if (vertical === undefined) throw new CliUsageError(`unknown entity flag: --${flag}`);
  return vertical;
}
