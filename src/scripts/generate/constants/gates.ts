import { type GateName } from "./ids.ts";

const MINUTE_MS = 60_000;

export const GATE_TIMEOUT_MS: Record<GateName, number> = {
  install: 15 * MINUTE_MS,
  types: 5 * MINUTE_MS,
  importmap: 5 * MINUTE_MS,
  seed: 40 * MINUTE_MS,
  build: 20 * MINUTE_MS,
  lint: 5 * MINUTE_MS,
};

export const BLOCKING_GATES: ReadonlySet<GateName> = new Set<GateName>([
  "install",
  "types",
  "importmap",
  "seed",
  "build",
]);
