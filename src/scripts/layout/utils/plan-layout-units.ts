import type { PagesData } from "#ir/pages.ts";
import { routeDir } from "#lib/route-dir.ts";

import { layoutRouteStepId } from "../constants/ids.ts";
import type { LayoutStaticUnit } from "../types.ts";

export function planLayoutUnits(opts: { pages: PagesData; rendered: Map<string, string> }): LayoutStaticUnit[] {
  return opts.pages.pages
    .filter((page) => page.kind === "static" && opts.rendered.has(page.route))
    .map((page) => ({
      kind: "static" as const,
      route: page.route,
      routeKey: routeDir(page.route),
      stepId: layoutRouteStepId(page.route),
    }))
    .sort((a, b) => a.route.localeCompare(b.route));
}
