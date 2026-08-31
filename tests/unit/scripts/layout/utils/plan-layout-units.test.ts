import { planLayoutUnits } from "#layout/utils/plan-layout-units.ts";
import type { PagesData } from "#ir/pages.ts";

const pages = {
  pages: [
    { route: "/", kind: "static", sources: ["sitemap"] },
    { route: "/about", kind: "static", sources: ["sitemap"] },
    { route: "/works/beta", kind: "item", collectionKey: "works", slug: "beta", sources: ["sitemap"] },
    { route: "/works/alpha", kind: "item", collectionKey: "works", slug: "alpha", sources: ["sitemap"] },
    { route: "/hidden", kind: "static", sources: ["crawl"] },
  ],
  collections: [{ key: "works", routePattern: "/works/:slug", itemCount: 2 }],
} as unknown as PagesData;

const rendered = new Map(
  ["/", "/about", "/works/beta", "/works/alpha"].map((route) => [route, `pages${route}/index.rendered.html`]),
);

describe("planLayoutUnits", () => {
  it("plans a unit per captured static route, sorted", () => {
    const units = planLayoutUnits({ pages, rendered });
    expect(units.map((unit) => unit.route)).toEqual(["/", "/about"]);
    expect(units[0]).toEqual({ kind: "static", route: "/", routeKey: "index", stepId: "layout:route:/" });
  });

  it("excludes item routes and static routes without a rendered snapshot", () => {
    const units = planLayoutUnits({ pages, rendered });
    const routes = units.map((unit) => unit.route);
    expect(routes).not.toContain("/works/beta");
    expect(routes).not.toContain("/works/alpha");
    expect(routes).not.toContain("/hidden");
  });
});
