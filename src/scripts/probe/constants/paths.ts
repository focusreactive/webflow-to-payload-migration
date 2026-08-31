import { join } from "node:path";

export const PROBE_404_PATH = "/__migration-probe-404__";

export const PROBE_PATHS = {
  home: "probe/home.html",
  headers: "probe/headers.json",
  robots: "probe/robots.txt",
  sitemap: "probe/sitemap.xml",
  notFound: "probe/not-found.html",
} as const;

export const LOG_RELATIVE_PATH = join(".migration", "logs", "probe.log");
