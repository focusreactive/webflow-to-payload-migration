import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8")) as {
  imports: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe("toolchain", () => {
  it("maps every subpath import into src/", () => {
    for (const [specifier, target] of Object.entries(pkg.imports)) {
      expect(specifier.endsWith("/*"), specifier).toBe(true);
      expect(target.startsWith("./src/"), specifier).toBe(true);
      expect(target.endsWith("/*"), specifier).toBe(true);
    }
  });

  it("carries no subpath imports for the dropped stimuli, verify and mig trees", () => {
    for (const specifier of ["#stimuli/*", "#verify/*", "#mig/*"]) {
      expect(pkg.imports).not.toHaveProperty(specifier);
    }
  });

  it("carries no dependency that was left behind in the private repo", () => {
    for (const dep of ["pixelmatch", "giget"]) {
      expect(pkg.devDependencies).not.toHaveProperty(dep);
    }
  });
});
