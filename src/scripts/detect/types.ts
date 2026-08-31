import type { ProbeView } from "#detect/probe-view.ts";

export interface SignalHit {
  evidence: string;
}

export interface Signal {
  id: string;
  platform: "webflow";
  description: string;
  tier: "strong" | "medium" | "weak";
  family?: string;
  tier1Html?: boolean;
  instant?: boolean;
  match: (view: ProbeView) => SignalHit | null;
}
