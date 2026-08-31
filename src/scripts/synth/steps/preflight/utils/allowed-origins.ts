const ALLOWED_ORIGINS_FLAG = "--allowed-origins";

export function allowsOrigin(entries: string[], origin: string): boolean {
  const target = new URL(origin);
  return entries.some((entry) => {
    const [scheme = "*", authority = ""] = entry.includes("://") ? entry.split("://") : ["*", entry];
    if (authority === "") return false;
    const [host = "", port = ""] = authority.split(":");
    const matches = (pattern: string, value: string): boolean => pattern === "*" || pattern === value;
    return (
      matches(scheme, target.protocol.replace(":", "")) && matches(host, target.hostname) && matches(port, target.port)
    );
  });
}

export function allowedOriginEntries(args: string[]): string[] {
  const raw = args.find((arg) => arg.startsWith(`${ALLOWED_ORIGINS_FLAG}=`))?.slice(ALLOWED_ORIGINS_FLAG.length + 1);
  const value = raw ?? (args.includes(ALLOWED_ORIGINS_FLAG) ? args[args.indexOf(ALLOWED_ORIGINS_FLAG) + 1] : undefined);
  return (value ?? "").split(";").filter((entry) => entry !== "");
}
