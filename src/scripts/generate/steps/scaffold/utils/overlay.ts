import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const APP_ROUTE_DIR = join("src", "app");
const ROUTE_ENTRY_FILES = new Set(["page.tsx", "page.ts", "page.jsx", "page.js", "route.ts", "route.tsx", "route.js"]);

function routePatternsOf(relativePath: string): string[] {
  const segments = relativePath.split(sep);
  const file = segments.pop();
  if (file === undefined || !ROUTE_ENTRY_FILES.has(file)) return [];
  if (relative(APP_ROUTE_DIR, segments.join(sep)).startsWith("..")) return [];

  const url: string[] = [];
  let optionalCatchAll = false;
  for (const segment of segments.slice(APP_ROUTE_DIR.split(sep).length)) {
    if (segment.startsWith("(") || segment.startsWith("@") || segment.startsWith("_")) continue;
    if (/^\[\[\.\.\..+\]\]$/.test(segment)) {
      url.push("*");
      optionalCatchAll = true;
      continue;
    }
    url.push(
      segment.startsWith("[") ?
        segment.startsWith("[...") ?
          "*"
        : ":"
      : segment,
    );
  }

  return optionalCatchAll ? [url.join("/"), url.slice(0, -1).join("/")] : [url.join("/")];
}

function laidRouteFiles(projectPath: string): string[] {
  const appDir = join(projectPath, APP_ROUTE_DIR);
  if (!existsSync(appDir)) return [];
  return readdirSync(appDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && ROUTE_ENTRY_FILES.has(entry.name))
    .map((entry) => relative(projectPath, join(entry.parentPath, entry.name)));
}

export function assertNoRouteCollision(opts: {
  projectPath: string;
  templates: ReadonlyMap<string, string>;
  emitted: ReadonlyMap<string, string | Buffer>;
  previouslyWritten: readonly string[];
}): void {
  const written = new Set([...opts.templates.keys(), ...opts.emitted.keys()]);
  const stale = new Set(opts.previouslyWritten.filter((path) => !written.has(path)));

  const owners = new Map<string, Set<string>>();
  for (const relativePath of [...laidRouteFiles(opts.projectPath), ...written]) {
    if (stale.has(relativePath)) continue;
    for (const pattern of routePatternsOf(relativePath)) {
      const claimants = owners.get(pattern) ?? new Set<string>();
      claimants.add(relativePath);
      owners.set(pattern, claimants);
    }
  }

  const collisions = [...owners].filter(([, claimants]) => claimants.size > 1);
  if (collisions.length > 0) {
    throw new Error(
      "two route files claim the same URL, which next build refuses:\n"
        + collisions
          .map(([pattern, claimants]) => `  /${pattern} <- ${[...claimants].sort().join(", ")}`)
          .sort()
          .join("\n"),
    );
  }
}
