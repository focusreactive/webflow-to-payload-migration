import { describe, expect, it } from "vitest";

import { createOverlayDraft } from "#generate/overlay.ts";

describe("scaffold layout", () => {
  it("writes a flat standalone project, never an apps/cms monorepo", () => {
    const { draft, templates, emitted } = createOverlayDraft();
    draft.template("src/payload.config.ts", "");
    draft.emit("src/blocks/hero/config.ts", "");

    for (const path of [...templates.keys(), ...emitted.keys()]) {
      expect(path.startsWith("apps/")).toBe(false);
      expect(path.startsWith("packages/")).toBe(false);
    }
  });
});
