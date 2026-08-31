import { blocksDataSchema } from "#ir/blocks.ts";
import { assertNoGlobalDirCollision, globalComponentDir } from "#generate/paths.ts";

describe("global component staging", () => {
  it("stages chrome under the shared blocks artifacts dir", () => {
    expect(globalComponentDir("header")).toBe("global-header");
  });

  it("fails loud when a BlockTypeId collides with the chrome dirs", () => {
    const blocks = blocksDataSchema.parse({
      blocks: [
        {
          id: "global-header",
          name: "x",
          content: {},
          fields: [],
        },
      ],
    });
    expect(() => assertNoGlobalDirCollision(blocks)).toThrow(/global-header/);
    expect(() => assertNoGlobalDirCollision(blocksDataSchema.parse({ blocks: [] }))).not.toThrow();
  });
});
