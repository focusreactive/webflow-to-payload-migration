import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { toolRootDir } from "#lib/migrate-config/index.ts";

import { allowedOriginEntries } from "./allowed-origins.ts";

const PLAYWRIGHT_MCP_CONFIG_FILE_NAME = "playwright-mcp.json";
const LANE_CONFIG_FILE_NAME = ".mcp.json";

const playwrightMcpConfigSchema = z.object({
  browser: z.object({
    contextOptions: z.object({
      deviceScaleFactor: z.number().positive(),
    }),
  }),
});

const laneConfigSchema = z.object({
  mcpServers: z.record(z.string(), z.object({ args: z.array(z.string()).optional() })),
});

export async function readMcpDeviceScaleFactor(): Promise<number> {
  const path = join(toolRootDir(), PLAYWRIGHT_MCP_CONFIG_FILE_NAME);
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  return playwrightMcpConfigSchema.parse(raw).browser.contextOptions.deviceScaleFactor;
}

export async function readLaneAllowedOrigins(): Promise<Record<string, string[]>> {
  const path = join(toolRootDir(), LANE_CONFIG_FILE_NAME);
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  const servers = laneConfigSchema.parse(raw).mcpServers;
  return Object.fromEntries(
    Object.entries(servers).map(([lane, server]) => [lane, allowedOriginEntries(server.args ?? [])]),
  );
}
