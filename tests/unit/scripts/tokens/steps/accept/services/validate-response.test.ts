import { validateResponse } from "#tokens/steps/accept/services/validate-response.ts";

import { candidates, response } from "../../../fixtures/tokens.ts";

function codesFor(mutate: (draft: ReturnType<typeof response>) => void): string[] {
  const draft = response();
  mutate(draft);
  const result = validateResponse(candidates(), draft);
  return result.ok ? [] : result.errors.map((error) => error.code);
}

describe("validateResponse", () => {
  it("accepts a response that covers every candidate and resolves its references", () => {
    const result = validateResponse(candidates(), response());
    expect(result.ok).toBe(true);
  });

  it("reports a schema violation instead of guessing", () => {
    const result = validateResponse(candidates(), { colors: { primitives: [], roles: [] } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.every((error) => error.code === "SCHEMA")).toBe(true);
  });

  it("rejects a name that is not kebab-case", () => {
    expect(codesFor((draft) => (draft.fontSizes = [{ candidateId: "font-size-1", name: "Base" }]))).toContain("SCHEMA");
  });

  it("reports every uncovered candidate at once", () => {
    const result = validateResponse(candidates(), { ...response(), spacings: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const notCovered = result.errors.find((error) => error.code === "NOT_COVERED");
      expect(notCovered?.got).toBe("spacing-1, spacing-2, spacing-3");
    }
  });

  it("rejects an invented candidate id", () => {
    expect(codesFor((draft) => draft.radii.push({ candidateId: "radius-9", name: "xl" }))).toContain("UNKNOWN_ID");
  });

  it("rejects a candidate covered twice", () => {
    expect(
      codesFor((draft) =>
        draft.colors.roles.push({ name: "veil", value: "{primitive.color.ink-900}", candidateId: "color-3" }),
      ),
    ).toContain("DUPLICATE_ID");
  });

  it("rejects a role name that collides with a primitive name", () => {
    expect(codesFor((draft) => (draft.colors.primitives[0] = { candidateId: "color-1", name: "surface" }))).toContain(
      "DUPLICATE_NAME",
    );
  });

  it("rejects a reference to a primitive that was never named", () => {
    expect(
      codesFor(
        (draft) => (draft.colors.roles[0] = { name: "surface", value: "{primitive.color.ghost}", candidateId: "" }),
      ),
    ).toContain("UNRESOLVED_REF");
  });

  it("rejects a cycle between roles", () => {
    expect(
      codesFor((draft) => {
        draft.colors.roles[0] = { name: "surface", value: "{semantic.color.scrim}", candidateId: "" };
        draft.colors.roles[1] = { name: "scrim", value: "{semantic.color.surface}", candidateId: "color-3" };
      }),
    ).toContain("REF_CYCLE");
  });
});
