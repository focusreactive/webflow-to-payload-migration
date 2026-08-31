import type { SynthVertical } from "../types.ts";

export function stepLabel(vertical: SynthVertical, step: string): string {
  return `synth:${vertical.id}:${step}`;
}
