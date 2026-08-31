import { join } from "node:path";

export function toolRootDir(): string {
  return join(import.meta.dirname, "..", "..", "..");
}
