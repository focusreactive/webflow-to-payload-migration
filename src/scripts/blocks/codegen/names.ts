import { type BlockTypeId } from "#ir/common.ts";

export function blockComponentName(id: BlockTypeId): string {
  return String(id)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

export function blockDirName(id: BlockTypeId): string {
  return String(id);
}

export function blockPropsInterfaceName(id: BlockTypeId): string {
  return `${blockComponentName(id)}Props`;
}
