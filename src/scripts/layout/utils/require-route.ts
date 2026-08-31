import { CliUsageError } from "#lib/cli/index.ts";

export function requireRoute(args: Record<string, string | boolean | undefined>, flag: string): string {
  const route = args["route"];
  if (typeof route !== "string" || route === "") {
    throw new CliUsageError(`--route <route> is required for --${flag}`);
  }
  return route;
}
