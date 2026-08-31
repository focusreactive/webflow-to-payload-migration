import { pathToFileURL } from "node:url";

import { CliUsageError, parseServiceArgs } from "#lib/cli/index.ts";

import { createReplayServer } from "./server.ts";

const DEFAULT_PORT = 0;
const RADIX_DECIMAL = 10;

async function main(): Promise<void> {
  const args = parseServiceArgs(process.argv.slice(2), { extraFlags: { port: { type: "string" } } });
  const port = typeof args["port"] === "string" ? Number.parseInt(args["port"], RADIX_DECIMAL) : DEFAULT_PORT;
  if (Number.isNaN(port)) throw new CliUsageError("--port must be a number");

  const server = await createReplayServer({ projectPath: args.projectPath, port });
  process.stdout.write(`${JSON.stringify({ step: "replay", origin: server.origin })}\n`);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      void server.close().then(() => process.exit(0));
    });
  }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(error instanceof CliUsageError ? error.exitCode : 1);
  }
}
