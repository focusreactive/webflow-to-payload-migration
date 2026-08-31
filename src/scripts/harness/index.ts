import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createServer, type Plugin, type ViteDevServer } from "vite";

import { CliUsageError, parseServiceArgs } from "#lib/cli/index.ts";

export interface HarnessServer {
  origin: string;
  renderUrl(args: { kind: "block" | "global" | "detail"; entry: string; inputPath: string }): string;
  close(): Promise<void>;
}

const here = dirname(fileURLToPath(import.meta.url));
const CONFIG = resolve(here, "../../harness/block-preview/vite.config.ts");

const HEALTH_ROUTE = "/_health";
const HTTP_OK = 200;

// Registered from configureServer without returning a function, so Vite installs it
// as a "pre" middleware — ahead of its own internal ones, in particular the
// index.html fallback. Without that ordering the fallback would answer /_health
// with 200 for any listening-but-broken harness, and the preflight check that
// relies on this route would never be able to fail.
function healthCheckPlugin(): Plugin {
  return {
    name: "harness:health",
    configureServer(server) {
      server.middlewares.use(HEALTH_ROUTE, (_req, res) => {
        res.writeHead(HTTP_OK, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
      });
    },
  };
}

export async function startHarness(projectDir: string): Promise<HarnessServer> {
  process.env.MIGRATE_PROJECT = projectDir;

  const server: ViteDevServer = await createServer({
    configFile: CONFIG,
    server: { port: 0 },
    plugins: [healthCheckPlugin()],
  });
  await server.listen();

  const addr = server.httpServer?.address();
  if (!addr || typeof addr === "string") throw new Error("harness: no address");

  const origin = `http://localhost:${addr.port}`;

  return {
    origin,
    // The props are fetched from disk rather than carried in the query string:
    // a global with a full navigation tree is tens of kilobytes, and an url
    // that long is rejected by the http parser before the page ever renders.
    renderUrl: ({ kind, entry, inputPath }) =>
      `${origin}/?kind=${kind}&entry=${encodeURIComponent(entry)}&input=${encodeURIComponent(`/@fs${inputPath}`)}`,
    close: () => server.close(),
  };
}

async function main(): Promise<void> {
  const args = parseServiceArgs(process.argv.slice(2));

  const harness = await startHarness(args.projectPath);
  process.stdout.write(`${JSON.stringify({ step: "harness", origin: harness.origin })}\n`);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      void harness.close().then(() => process.exit(0));
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
