import type { BlockType } from "#ir/blocks.ts";

import type { MissedField } from "./schemas/layout-payload.ts";

export interface LayoutStaticUnit {
  kind: "static";
  route: string;
  routeKey: string;
  stepId: string;
}

export interface ChromeAnchor {
  name: string;
  sourceRoute: string;
  anchorMigId: string;
}

export interface LayoutUnitSubject {
  unit: LayoutStaticUnit;
  stitches: { viewport: string; file: string }[];
  renderedHtmlPath: string;
  stylesPath: string;
  vocabulary: BlockType[];
  chrome: ChromeAnchor[];
  responsePath: string;
}

export interface LayoutInstancePayload {
  blockType: string;
  anchorMigId: string;
  confidence: number;
  fields: Record<string, unknown>;
}

export interface LayoutPayload {
  unit: { kind: "static"; route: string };
  missedFields: MissedField[];
  blocks: LayoutInstancePayload[];
}

export interface AcceptError {
  code: string;
  where: string;
  got?: unknown;
  expected?: unknown;
  detail?: string;
  fix: string;
}
