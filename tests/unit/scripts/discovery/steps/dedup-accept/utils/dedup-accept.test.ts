import { dedupResponseSchema } from "#discovery/schemas/dedup-response.ts";
import { validateDedupResponse } from "#discovery/steps/dedup-accept/utils/dedup-accept.ts";

const SHARDS = [
  {
    route: "/",
    instances: [
      { route: "/", nodeIds: ["mig-5"], role: "hero", summary: "", boundaries: {} },
      { route: "/", nodeIds: ["mig-9"], role: "cta", summary: "", boundaries: {} },
    ],
  },
];

function response(types: unknown[]) {
  return dedupResponseSchema.parse({ types });
}

const HERO = {
  name: "Hero",
  role: "hero",
  exemplar: { route: "/", nodeId: "mig-5" },
  members: [{ route: "/", nodeId: "mig-5" }],
  collectionKey: null,
};
const CTA = {
  name: "Cta",
  role: "cta",
  exemplar: { route: "/", nodeId: "mig-9" },
  members: [{ route: "/", nodeId: "mig-9" }],
  collectionKey: null,
};

describe("validateDedupResponse", () => {
  it("passes when every listed instance lands in exactly one type", () => {
    expect(validateDedupResponse({ response: response([HERO, CTA]), shards: SHARDS })).toEqual([]);
  });

  it("reports instances left without a type", () => {
    const errors = validateDedupResponse({ response: response([HERO]), shards: SHARDS });
    expect(errors.map((error) => error.code)).toEqual(["INPUT_NOT_COVERED"]);
    expect(errors[0]?.detail).toContain("/::mig-9");
  });

  it("reports a member that was never listed", () => {
    const invented = { ...CTA, members: [{ route: "/", nodeId: "mig-404" }] };
    const errors = validateDedupResponse({ response: response([HERO, invented]), shards: SHARDS });
    expect(errors.map((error) => error.code)).toEqual(["UNKNOWN_ID", "EXEMPLAR_NOT_MEMBER", "INPUT_NOT_COVERED"]);
  });

  it("reports an instance claimed by two types", () => {
    const twin = { ...CTA, members: [{ route: "/", nodeId: "mig-5" }], exemplar: { route: "/", nodeId: "mig-5" } };
    const errors = validateDedupResponse({ response: response([HERO, twin]), shards: SHARDS });
    expect(errors.map((error) => error.code)).toEqual(["DUPLICATE_ID", "INPUT_NOT_COVERED"]);
  });
});
