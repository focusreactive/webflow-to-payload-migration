import { ASSETS_STEP_PREFIX } from "#assets/constants/ids.ts";

export const REFRESH_CLEARED_STEP_PREFIXES = [
  ASSETS_STEP_PREFIX,
  "tokens",
  "discovery",
  "synth:collections",
  "synth:globals",
  "synth:blocks",
  "layout",
  "generate",
] as const;
