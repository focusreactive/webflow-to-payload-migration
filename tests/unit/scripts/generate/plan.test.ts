import { manifestSchema } from "#lib/manifest/schema.ts";
import { planGenerateUnits } from "#generate/plan.ts";

const manifest = manifestSchema.parse({
  schemaVersion: 1,
  toolVersion: "0.1.0",
  sourceUrl: "https://acme.example",
  steps: { "generate:scaffold": { status: "failed" } },
});

describe("planGenerateUnits", () => {
  it("orders scaffold -> gates and reads statuses from the manifest", () => {
    const units = planGenerateUnits({ manifest });
    expect(units.map((u) => u.stepId)).toEqual([
      "generate:scaffold",
      "generate:install",
      "generate:types",
      "generate:importmap",
      "generate:seed",
      "generate:build",
      "generate:lint",
    ]);
    expect(units[0]).toMatchObject({ kind: "scaffold", status: "failed" });
    expect(units[1]).toMatchObject({ kind: "gate", name: "install", status: "pending" });
  });

  it("puts scaffold first and lists six gates", () => {
    const units = planGenerateUnits({
      manifest: { schemaVersion: 1, toolVersion: "0", sourceUrl: "u", steps: {} },
    });
    expect(units[0]).toMatchObject({ stepId: "generate:scaffold", kind: "scaffold" });
    expect(units.filter((unit) => unit.kind === "gate").map((unit) => unit.name)).toEqual([
      "install",
      "types",
      "importmap",
      "seed",
      "build",
      "lint",
    ]);
  });
});
