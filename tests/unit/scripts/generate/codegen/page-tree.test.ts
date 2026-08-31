import { buildPageTree } from "#generate/codegen/page-tree.ts";

describe("buildPageTree", () => {
  it("maps the root route to the home slug without a parent", () => {
    expect(buildPageTree(["/"])).toEqual([
      {
        path: "home",
        slug: "home",
        parentPath: null,
        depth: 0,
        route: "/",
        title: "Home",
        metaTitle: null,
        metaDescription: null,
      },
    ]);
  });

  it("creates a container for a missing intermediate segment", () => {
    const nodes = buildPageTree(["/solutions/devops"]);

    expect(nodes.map((node) => [node.path, node.route])).toEqual([
      ["solutions", null],
      ["solutions/devops", "/solutions/devops"],
    ]);
    expect(nodes[1]?.parentPath).toBe("solutions");
  });

  it("keeps a captured intermediate route as a real page", () => {
    const nodes = buildPageTree(["/solutions", "/solutions/devops"]);

    expect(nodes[0]).toMatchObject({ path: "solutions", route: "/solutions" });
  });

  it("orders nodes by depth so a parent is always created first", () => {
    const nodes = buildPageTree(["/a/b/c", "/a"]);

    expect(nodes.map((node) => node.depth)).toEqual([0, 1, 2]);
    expect(nodes.map((node) => node.path)).toEqual(["a", "a/b", "a/b/c"]);
  });

  it("allows the same last segment in two branches", () => {
    const nodes = buildPageTree(["/products/pricing", "/services/pricing"]);

    expect(nodes.filter((node) => node.slug === "pricing")).toHaveLength(2);
    expect(nodes.filter((node) => node.slug === "pricing").map((node) => node.parentPath)).toEqual([
      "products",
      "services",
    ]);
  });

  it("derives a readable title from the last segment", () => {
    expect(buildPageTree(["/about-us"])[0]?.title).toBe("About us");
  });

  // page.slug and page.title are both required in the base collection, and payload enforces
  // required fields on publish — an empty one would abort the whole seed.
  it("drops an empty path segment instead of emitting an empty slug", () => {
    const nodes = buildPageTree(["/a//b"]);

    expect(nodes.map((node) => [node.path, node.slug, node.title])).toEqual([
      ["a", "a", "A"],
      ["a/b", "b", "B"],
    ]);
    expect(nodes[1]).toMatchObject({ parentPath: "a", route: "/a//b" });
  });

  it("falls back to the raw slug when the slug title-cases to nothing", () => {
    expect(buildPageTree(["/--"])[0]).toMatchObject({ slug: "--", title: "--" });
  });

  it("never emits an empty slug or an empty title", () => {
    const nodes = buildPageTree(["/", "/a//b", "/--", "/_", "//"]);

    expect(nodes).not.toHaveLength(0);
    for (const node of nodes) {
      expect(node.slug).not.toBe("");
      expect(node.title).not.toBe("");
    }
  });

  it("does not duplicate a route listed twice", () => {
    expect(buildPageTree(["/a", "/a"])).toHaveLength(1);
  });
});
