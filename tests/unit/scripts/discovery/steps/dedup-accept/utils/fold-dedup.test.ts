import { instanceKey } from "#discovery/steps/dedup-accept/utils/fold-dedup.ts";

describe("instanceKey", () => {
  it("keys on route + first node id", () => {
    expect(instanceKey("/about", ["mig-9", "mig-10"])).toBe("/about::mig-9");
  });
});
