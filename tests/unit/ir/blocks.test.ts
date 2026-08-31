import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readArtifact, writeArtifact } from "#ir/artifact.ts";
import { BLOCKS_SCHEMA_VERSION, blocksArtifact, blocksDataSchema, blockTypeSchema } from "#ir/blocks.ts";

const validBlock = () => ({
  id: "hero",
  name: "Hero",
  fields: [
    { name: "heading", type: { type: "text" }, required: true },
    {
      name: "items",
      type: {
        type: "array",
        element: { type: "group", fields: [{ name: "label", type: { type: "text" }, required: true }] },
      },
      required: false,
    },
  ],
  content: { heading: "Welcome" },
});

describe("blockTypeSchema", () => {
  it("accepts a block with recursive (group/array) fields", () => {
    expect(blockTypeSchema.safeParse(validBlock()).success).toBe(true);
  });

  it("rejects unknown top-level keys (strict)", () => {
    expect(blockTypeSchema.safeParse({ ...validBlock(), extra: 1 }).success).toBe(false);
  });

  it("rejects a field with an unknown type", () => {
    const b = validBlock();
    b.fields[0]!.type = { type: "nope" };
    expect(blockTypeSchema.safeParse(b).success).toBe(false);
  });
});

describe("blocksArtifact round-trip", () => {
  it("writes and reads blocks.json through the envelope", async () => {
    const dir = await mkdtemp(join(tmpdir(), "m5-blocks-"));
    const data = blocksDataSchema.parse({ blocks: [validBlock()] });

    await writeArtifact(dir, blocksArtifact, { provenance: "ai", data });
    const read = await readArtifact(dir, blocksArtifact);

    expect(read.provenance).toBe("ai");
    expect(read.data.blocks[0]!.id).toBe("hero");
    expect(read.data.blocks[0]!.content).toEqual({ heading: "Welcome" });
  });
});

describe("BLOCKS_SCHEMA_VERSION", () => {
  it("is 2", () => {
    expect(BLOCKS_SCHEMA_VERSION).toBe(3);
  });
});
