import type { z } from "zod";

import type { IngestField } from "#ir/field-value.ts";
import type { Vertical } from "#lib/synth-store/paths.ts";

export type EntityFlag = "block" | "global" | "collection";

export interface AcceptError {
  code: string;
  where: string;
  detail?: string;
  got?: unknown;
  expected?: unknown;
  fix: string;
}

export interface EntityAddress {
  key: string;
  section?: string;
}

export interface RosterEntity {
  key: string;
  sections: string[];
}

export type AcceptOutcome<T> = { ok: true; shard: T } | { ok: false; errors: AcceptError[] };

export interface FoldResult {
  count: number;
}

export interface Exemplar {
  route: string;
  nodeIds: string[];
}

export interface SynthVertical {
  id: Vertical;
  entityFlag: EntityFlag;
  stepId: string;
  sectioned: boolean;

  roster(projectPath: string): Promise<RosterEntity[]>;

  surfaceKey(address: EntityAddress): string;
  exemplar(projectPath: string, address: EntityAddress): Promise<Exemplar>;
  surfaceDir(projectPath: string, address: EntityAddress): string;

  fieldsResponseSchema(projectPath: string, address: EntityAddress): Promise<z.ZodType>;
  fieldsSubject(projectPath: string, address: EntityAddress): Promise<unknown>;
  acceptFields(projectPath: string, address: EntityAddress, response: unknown): Promise<AcceptOutcome<unknown>>;
  emitCodegen(projectPath: string, address: EntityAddress, shard: unknown): Promise<void>;

  contentResponseSchema(projectPath: string, key: string): Promise<z.ZodType>;
  contentSubject(projectPath: string, key: string): Promise<unknown>;
  acceptContent(projectPath: string, key: string, response: unknown): Promise<AcceptOutcome<unknown>>;

  surfaceFields(projectPath: string, address: EntityAddress): Promise<IngestField[]>;
  surfaceLiterals(projectPath: string, address: EntityAddress): Promise<Record<string, unknown>>;

  fold(projectPath: string): Promise<FoldResult>;
}
