import { existsSync, readdirSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { writeFileAtomic } from "#lib/fs.ts";

import { DELIVERABLE_FILES_ARTIFACT_PATH } from "./paths.ts";

// Property signatures, not methods: callers pass `draft.emit` around as a plain
// collector, and a method signature would make that an unbound-method violation.
export interface OverlayDraft {
  template: (relativePath: string, content: string) => void;
  emit: (relativePath: string, content: string | Buffer) => void;
}

export function createOverlayDraft(): {
  draft: OverlayDraft;
  templates: Map<string, string>;
  emitted: Map<string, string | Buffer>;
} {
  const templates = new Map<string, string>();
  const emitted = new Map<string, string | Buffer>();
  return {
    templates,
    emitted,
    draft: {
      template: (relativePath, content) => templates.set(relativePath, content),
      emit: (relativePath, content) => emitted.set(relativePath, content),
    },
  };
}

const APP_ROUTE_DIR = join("src", "app");
const ROUTE_ENTRY_FILES = new Set(["page.tsx", "page.ts", "page.jsx", "page.js", "route.ts", "route.tsx", "route.js"]);

// Next derives a URL from a route file's whole directory chain, so two files that never touch
// each other on disk can still claim the same URL — and `next build` refuses that. The
// file-existence seam below cannot see it: the pre-overlay `(frontend)/[[...slug]]/page.tsx`
// overwrote no base file at all, yet it claimed `/` alongside the base's `(frontend)/page.tsx`
// for fourteen phases. Dynamic segments compare by position, not by slug name, because that is
// how Next compares them.
function routePatternsOf(relativePath: string): string[] {
  const segments = relativePath.split(sep);
  const file = segments.pop();
  if (file === undefined || !ROUTE_ENTRY_FILES.has(file)) return [];
  if (relative(APP_ROUTE_DIR, segments.join(sep)).startsWith("..")) return [];

  const url: string[] = [];
  let optionalCatchAll = false;
  for (const segment of segments.slice(APP_ROUTE_DIR.split(sep).length)) {
    // Route groups, parallel routes and private folders contribute nothing to the URL.
    if (segment.startsWith("(") || segment.startsWith("@") || segment.startsWith("_")) continue;
    if (/^\[\[\.\.\..+\]\]$/.test(segment)) {
      url.push("*");
      optionalCatchAll = true;
      continue;
    }
    url.push(segment.startsWith("[") ? (segment.startsWith("[...") ? "*" : ":") : segment);
  }

  // An optional catch-all also matches the URL without its own segment, which is exactly what
  // makes it collide with a page.tsx one level up.
  return optionalCatchAll ? [url.join("/"), url.slice(0, -1).join("/")] : [url.join("/")];
}

function laidRouteFiles(projectPath: string): string[] {
  const appDir = join(projectPath, APP_ROUTE_DIR);
  if (!existsSync(appDir)) return [];
  return readdirSync(appDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && ROUTE_ENTRY_FILES.has(entry.name))
    .map((entry) => relative(projectPath, join(entry.parentPath, entry.name)));
}

function assertNoRouteCollision(opts: {
  projectPath: string;
  templates: ReadonlyMap<string, string>;
  emitted: ReadonlyMap<string, string | Buffer>;
  previouslyWritten: readonly string[];
}): void {
  const written = new Set([...opts.templates.keys(), ...opts.emitted.keys()]);
  // Stale route files from an earlier run are deleted by writeOverlay right after this check,
  // so they must not be counted as claimants.
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

export function assertLayerSeams(opts: {
  projectPath: string;
  templates: ReadonlyMap<string, string>;
  emitted: ReadonlyMap<string, string | Buffer>;
  previouslyWritten: readonly string[];
}): void {
  // Every file in the deliverable is written by this tool, so emission landing on a file no
  // earlier run of it wrote means two writers disagree about who owns that path.
  const allowed = new Set<string>(opts.previouslyWritten);
  const collisions = [...opts.emitted.keys()].filter(
    (relativePath) => existsSync(join(opts.projectPath, relativePath)) && !allowed.has(relativePath),
  );
  if (collisions.length > 0) {
    throw new Error(
      "emission would overwrite files this tool did not write:\n"
        + collisions.map((path) => `  ${path}`).join("\n"),
    );
  }

  assertNoRouteCollision(opts);
}

export async function readPreviouslyWritten(projectPath: string): Promise<string[]> {
  const artifact = join(projectPath, DELIVERABLE_FILES_ARTIFACT_PATH);
  if (!existsSync(artifact)) return [];
  const raw: unknown = JSON.parse(await readFile(artifact, "utf8"));
  if (typeof raw !== "object" || raw === null || !("files" in raw)) return [];
  const { files }: { files: unknown } = raw;
  return Array.isArray(files) ? files.filter((entry: unknown): entry is string => typeof entry === "string") : [];
}

export async function writeOverlay(opts: {
  projectPath: string;
  templates: ReadonlyMap<string, string>;
  emitted: ReadonlyMap<string, string | Buffer>;
  previouslyWritten: readonly string[];
}): Promise<{ files: string[]; removed: string[] }> {
  assertLayerSeams(opts);

  for (const [relativePath, content] of [...opts.templates, ...opts.emitted]) {
    await writeFileAtomic(join(opts.projectPath, relativePath), content);
  }

  const written = new Set([...opts.templates.keys(), ...opts.emitted.keys()]);
  const removed: string[] = [];
  for (const relativePath of opts.previouslyWritten) {
    if (written.has(relativePath)) continue;
    await rm(join(opts.projectPath, relativePath), { force: true });
    removed.push(relativePath);
  }

  return { files: [...written].sort(), removed: removed.sort() };
}
