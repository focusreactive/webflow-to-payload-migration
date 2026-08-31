import { type Manifest } from "#lib/manifest/schema.ts";

import { GATE_NAMES, GENERATE_SCAFFOLD_STEP_ID, generateGateStepId } from "./steps.ts";

export interface GenerateUnit {
  stepId: string;
  kind: "scaffold" | "gate";
  name?: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
}

function statusOf(manifest: Manifest, stepId: string): GenerateUnit["status"] {
  return manifest.steps[stepId]?.status ?? "pending";
}

export function planGenerateUnits(opts: { manifest: Manifest }): GenerateUnit[] {
  const units: GenerateUnit[] = [];

  units.push({
    stepId: GENERATE_SCAFFOLD_STEP_ID,
    kind: "scaffold",
    status: statusOf(opts.manifest, GENERATE_SCAFFOLD_STEP_ID),
  });

  for (const gate of GATE_NAMES) {
    const stepId = generateGateStepId(gate);
    units.push({ stepId, kind: "gate", name: gate, status: statusOf(opts.manifest, stepId) });
  }

  return units;
}
