import { buildDedupSubject } from "#discovery/steps/dedup-subject/build-dedup-subject.ts";
import type { BlockInstance } from "#ir/discovery.ts";

describe("buildDedupSubject", () => {
  it("flattens boundaries to rectsByViewport per instance", () => {
    const instances: BlockInstance[] = [
      {
        route: "/",
        nodeIds: ["mig-5"],
        role: "hero",
        summary: "s",
        boundaries: { desktop: { rect: { x: 0, y: 0, width: 1440, height: 600 } } },
      },
    ];
    expect(buildDedupSubject({ instances }).instances).toEqual([
      {
        route: "/",
        nodeIds: ["mig-5"],
        role: "hero",
        summary: "s",
        rectsByViewport: { desktop: { x: 0, y: 0, width: 1440, height: 600 } },
      },
    ]);
  });
});
