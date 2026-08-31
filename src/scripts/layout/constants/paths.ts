import { join } from "node:path";

const STEP_DIR = join(".migration", "steps", "layout");

export function responseRelativePath(routeKey: string): string {
  return join(STEP_DIR, routeKey, "response.json");
}
