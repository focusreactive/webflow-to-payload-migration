import { dedupResponseSchema } from "#discovery/schemas/dedup-response.ts";
import { foldDedup } from "#discovery/steps/dedup-accept/fold-dedup.ts";

describe("foldDedup", () => {
  it("mints stable type ids and takes the exemplar's whole anchor set from its shard", () => {
    const shards = [
      {
        route: "/",
        instances: [{ route: "/", nodeIds: ["mig-5", "mig-6"], role: "hero", summary: "", boundaries: {} }],
      },
    ];
    const folded = foldDedup({
      response: dedupResponseSchema.parse({
        types: [
          {
            name: "Hero",
            role: "hero",
            exemplar: { route: "/", nodeId: "mig-5" },
            members: [{ route: "/", nodeId: "mig-5" }],
            collectionKey: null,
          },
        ],
      }),
      shards,
    });
    expect(folded.types).toHaveLength(1);
    expect(folded.types[0]?.exemplar).toEqual({ route: "/", nodeIds: ["mig-5", "mig-6"] });

    // The judge's member list is not persisted, and neither is the occurrence
    // list: the shards under discovery/blocks/ stay on disk as that record.
    expect(folded.types[0]).not.toHaveProperty("members");
    expect(folded).not.toHaveProperty("instances");
  });

  it("falls back to the judge's single node when no shard instance matches", () => {
    const folded = foldDedup({
      response: dedupResponseSchema.parse({
        types: [
          {
            name: "Ghost",
            role: "ghost",
            exemplar: { route: "/", nodeId: "mig-404" },
            members: [{ route: "/", nodeId: "mig-404" }],
            collectionKey: null,
          },
        ],
      }),
      shards: [],
    });
    expect(folded.types[0]?.exemplar).toEqual({ route: "/", nodeIds: ["mig-404"] });
  });
});
