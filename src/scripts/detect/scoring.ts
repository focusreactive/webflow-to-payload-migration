import type { ProbeView } from "#detect/probe-view.ts";
import type { Signal } from "#detect/types.ts";

export const SIGNAL_WEIGHTS = { strong: 3, medium: 2, weak: 1 } as const;
export const CONFIDENCE_THRESHOLD = 6;
export const FAMILY_CAP = 6;
export const INSTANT_WEIGHT = CONFIDENCE_THRESHOLD;

export type Verdict = "webflow" | "unknown";

export interface PlatformScore {
  score: number;
  hasTier1Strong: boolean;
  signals: {
    id: string;
    tier: "strong" | "medium" | "weak";
    evidence: string;
  }[];
}

function contributionOf(signal: Signal): number {
  return signal.instant ? INSTANT_WEIGHT : SIGNAL_WEIGHTS[signal.tier];
}

export function scorePlatform(signals: Signal[], view: ProbeView): PlatformScore {
  const hits = signals
    .map((signal) => ({ signal, hit: signal.match(view) }))
    .filter(
      (
        entry,
      ): entry is {
        signal: Signal;
        hit: NonNullable<ReturnType<Signal["match"]>>;
      } => entry.hit !== null,
    );

  const familyTotals = new Map<string, number>();
  let ungroupedScore = 0;

  for (const { signal } of hits) {
    const contribution = contributionOf(signal);
    if (signal.family !== undefined) {
      familyTotals.set(signal.family, (familyTotals.get(signal.family) ?? 0) + contribution);
    } else {
      ungroupedScore += contribution;
    }
  }

  let familyScore = 0;
  for (const total of familyTotals.values()) {
    familyScore += Math.min(total, FAMILY_CAP);
  }

  const hasTier1Strong = hits.some(
    ({ signal }) => (signal.tier1Html === true && signal.tier === "strong") || signal.instant === true,
  );

  return {
    score: familyScore + ungroupedScore,
    hasTier1Strong,
    signals: hits.map(({ signal, hit }) => ({
      id: signal.id,
      tier: signal.tier,
      evidence: hit.evidence,
    })),
  };
}

export function decideVerdict(scores: { webflow: PlatformScore }): Verdict {
  if (scores.webflow.score < CONFIDENCE_THRESHOLD || !scores.webflow.hasTier1Strong) return "unknown";
  return "webflow";
}
