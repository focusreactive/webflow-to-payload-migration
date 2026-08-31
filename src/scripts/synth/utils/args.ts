import { CliUsageError } from "#lib/cli/index.ts";
import type { ServiceArgs } from "#lib/cli/index.ts";

type Args = ServiceArgs & Record<string, string | boolean | undefined>;

import type { EntityAddress, SynthVertical } from "../types.ts";
import { VERTICALS, verticalById } from "../verticals/index.ts";

const ENTITY_FLAG_USAGE = "--block <typeId> | --global <name> | --collection <key>";

function stringFlag(args: Args, flag: string): string | undefined {
  const value = args[flag];
  return typeof value === "string" && value !== "" ? value : undefined;
}

export interface Addressed {
  vertical: SynthVertical;
  address: EntityAddress;
}

export function requireAddress(args: Args): Addressed {
  const named = VERTICALS.filter((vertical) => stringFlag(args, vertical.entityFlag) !== undefined);
  if (named.length === 0) throw new CliUsageError(`one of ${ENTITY_FLAG_USAGE} is required`);
  if (named.length > 1) {
    throw new CliUsageError(`name one entity at a time: ${named.map((v) => `--${v.entityFlag}`).join(" and ")} given`);
  }

  const vertical = named[0] as SynthVertical;
  const key = stringFlag(args, vertical.entityFlag) as string;
  const section = stringFlag(args, "section");
  if (section !== undefined && !vertical.sectioned) {
    throw new CliUsageError(`--section applies to --collection only, not --${vertical.entityFlag}`);
  }
  return { vertical, address: section === undefined ? { key } : { key, section } };
}

export function requireSurface(args: Args): Addressed {
  const addressed = requireAddress(args);
  if (addressed.vertical.sectioned && addressed.address.section === undefined) {
    throw new CliUsageError("--section <id> is required (collection surfaces are synthesized as sections)");
  }
  return addressed;
}

export function requireEntityLevel(args: Args): { vertical: SynthVertical; key: string } {
  const { vertical, address } = requireAddress(args);
  if (address.section !== undefined) {
    throw new CliUsageError("content is captured per collection, not per section — drop --section");
  }
  return { vertical, key: address.key };
}

export function requireVertical(args: Args): SynthVertical {
  const value = stringFlag(args, "vertical");
  if (value === undefined) throw new CliUsageError("--vertical <collections|globals|blocks> is required");
  return verticalById(value);
}

export function requireOrigin(args: Args, flag: string): string {
  const value = stringFlag(args, flag);
  if (value === undefined) throw new CliUsageError(`--${flag} is required`);
  return value;
}
