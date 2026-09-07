import { blocksDataSchema } from "#ir/blocks.ts";
import { assertNoGlobalDirCollision } from "#generate/steps/scaffold/utils/emit-deliverable.ts";

describe("assertNoGlobalDirCollision", () => {
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
