import { z } from "zod";

import { colorRefs, parseSemanticColorValue } from "#lib/semantic-color.ts";

import { tokensResponseSchema, type TokensResponse } from "../../../schemas/judgement-response-schema.ts";
import type { TokenCandidatesData } from "../../../schemas/token-candidates.ts";

export interface AcceptError {
  code: string;
  where: string;
  got?: string;
  detail?: string;
  fix: string;
}

export type AcceptResult = { ok: true; response: TokensResponse } | { ok: false; errors: AcceptError[] };

interface NamedCandidate {
  candidateId: string;
  name: string;
}

function schemaErrors(issues: z.core.$ZodIssue[]): AcceptError[] {
  return issues.map((issue) => ({
    code: "SCHEMA",
    where: issue.path.join(".") || "(root)",
    detail: issue.message,
    fix: "Make the response match the schema printed by the schema step.",
  }));
}

function coverageErrors(opts: { label: string; candidateIds: string[]; verdicts: NamedCandidate[] }): AcceptError[] {
  const { label, candidateIds, verdicts } = opts;
  const errors: AcceptError[] = [];
  const known = new Set(candidateIds);
  const seen = new Set<string>();

  for (const verdict of verdicts) {
    if (!known.has(verdict.candidateId)) {
      errors.push({
        code: "UNKNOWN_ID",
        where: label,
        got: verdict.candidateId,
        detail: "No candidate with this id.",
        fix: "Drop this entry or point it at one of the listed candidate ids.",
      });
    } else if (seen.has(verdict.candidateId)) {
      errors.push({
        code: "DUPLICATE_ID",
        where: label,
        got: verdict.candidateId,
        detail: "This candidate is covered more than once.",
        fix: "Leave exactly one verdict per candidate.",
      });
    }
    seen.add(verdict.candidateId);
  }

  const missing = candidateIds.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    errors.push({
      code: "NOT_COVERED",
      where: label,
      got: missing.join(", "),
      detail: `${missing.length} candidate(s) have no verdict.`,
      fix: "Add a verdict for each listed candidate id.",
    });
  }

  return errors;
}

function duplicateNameErrors(label: string, names: string[]): AcceptError[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const name of names) {
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  }

  return [...duplicates].map((name) => ({
    code: "DUPLICATE_NAME",
    where: label,
    got: name,
    detail: "Two tokens in this namespace claim the same name.",
    fix: "Give each token a distinct name.",
  }));
}

function referenceErrors(response: TokensResponse): AcceptError[] {
  const primitiveNames = new Set(response.colors.primitives.map((primitive) => primitive.name));
  const roleValues = new Map(response.colors.roles.map((role) => [role.name, role.value]));
  const errors: AcceptError[] = [];

  const walk = (roleName: string, value: string, chain: Set<string>): void => {
    const parsed = parseSemanticColorValue(value);
    if (parsed === undefined) return;
    for (const ref of colorRefs(parsed)) {
      if (ref.tier === "primitive") {
        if (!primitiveNames.has(ref.name)) {
          errors.push({
            code: "UNRESOLVED_REF",
            where: `colors.roles.${roleName}`,
            got: `{primitive.color.${ref.name}}`,
            detail: "No Tier 1 primitive carries this name.",
            fix: "Reference a name listed in colors.primitives.",
          });
        }
        continue;
      }
      const target = roleValues.get(ref.name);
      if (target === undefined) {
        errors.push({
          code: "UNRESOLVED_REF",
          where: `colors.roles.${roleName}`,
          got: `{semantic.color.${ref.name}}`,
          detail: "No role carries this name.",
          fix: "Reference a name listed in colors.roles, or a Tier 1 primitive.",
        });
        continue;
      }
      if (chain.has(ref.name)) {
        errors.push({
          code: "REF_CYCLE",
          where: `colors.roles.${roleName}`,
          got: `{semantic.color.${ref.name}}`,
          detail: `Reference cycle: ${[...chain, ref.name].join(" → ")}.`,
          fix: "Break the cycle — a role chain must end at a Tier 1 primitive.",
        });
        continue;
      }
      walk(roleName, target, new Set([...chain, ref.name]));
    }
  };

  for (const role of response.colors.roles) walk(role.name, role.value, new Set([role.name]));
  return errors;
}

function flatCategories(
  candidates: TokenCandidatesData,
  response: TokensResponse,
): { label: string; candidateIds: string[]; verdicts: NamedCandidate[] }[] {
  const ids = (entries: { id: string }[]): string[] => entries.map((entry) => entry.id);

  return [
    { label: "fontFamilies", candidateIds: ids(candidates.fontFamilies), verdicts: response.fontFamilies },
    { label: "fontSizes", candidateIds: ids(candidates.fontSizes), verdicts: response.fontSizes },
    { label: "fontWeights", candidateIds: ids(candidates.fontWeights), verdicts: response.fontWeights },
    { label: "lineHeights", candidateIds: ids(candidates.lineHeights), verdicts: response.lineHeights },
    { label: "letterSpacings", candidateIds: ids(candidates.letterSpacings), verdicts: response.letterSpacings },
    { label: "spacings", candidateIds: ids(candidates.spacings), verdicts: response.spacings },
    { label: "radii", candidateIds: ids(candidates.radii), verdicts: response.radii },
    { label: "shadows", candidateIds: ids(candidates.shadows), verdicts: response.shadows },
    { label: "breakpoints", candidateIds: ids(candidates.breakpoints), verdicts: response.breakpoints },
  ];
}

export function validateResponse(candidates: TokenCandidatesData, raw: unknown): AcceptResult {
  const parsed = tokensResponseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: schemaErrors(parsed.error.issues) };
  const response = parsed.data;

  const colorVerdicts = [
    ...response.colors.primitives,
    ...response.colors.roles.filter((role) => role.candidateId !== ""),
  ];

  const errors = [
    ...coverageErrors({
      label: "colors",
      candidateIds: candidates.colors.map((color) => color.id),
      verdicts: colorVerdicts,
    }),
    ...duplicateNameErrors("colors", [
      ...response.colors.primitives.map((primitive) => primitive.name),
      ...response.colors.roles.map((role) => role.name),
    ]),
    ...referenceErrors(response),
  ];

  for (const category of flatCategories(candidates, response)) {
    errors.push(...coverageErrors(category));
    errors.push(
      ...duplicateNameErrors(
        category.label,
        category.verdicts.map((verdict) => verdict.name),
      ),
    );
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, response };
}
