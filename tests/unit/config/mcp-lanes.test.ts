import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { VIEWPORTS } from "#lib/capture/defaults.ts";

const ROOT = join(import.meta.dirname, "../../..");

async function json(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(join(ROOT, path), "utf8")) as Record<string, unknown>;
}

describe("mcp lanes", () => {
  it("declares five lanes with distinct output and profile directories", async () => {
    const config = (await json(".mcp.json")) as { mcpServers: Record<string, { args: string[] }> };
    const lanes = Object.keys(config.mcpServers);
    expect(lanes).toEqual(["pw-1", "pw-2", "pw-3", "pw-4", "pw-5"]);
    const outputs = lanes.map((lane) => config.mcpServers[lane]?.args.find((arg) => arg.startsWith("--output-dir=")));
    expect(new Set(outputs).size).toBe(lanes.length);
  });

  it("enables the vision capability on every lane", async () => {
    const config = (await json(".mcp.json")) as { mcpServers: Record<string, { args: string[] }> };
    for (const server of Object.values(config.mcpServers)) {
      expect(server.args).toContain("--caps=vision");
      expect(server.args).toContain("--allowed-origins=localhost;localhost:*");
      expect(server.args).toContain("--image-responses=omit");
    }
  });

  it("pins the device pixel ratio to the one the project captures with", async () => {
    const mcp = (await json("playwright-mcp.json")) as {
      browser: { contextOptions: { deviceScaleFactor: number } };
    };

    for (const viewport of Object.values(VIEWPORTS)) {
      expect(viewport.deviceScaleFactor).toBe(mcp.browser.contextOptions.deviceScaleFactor);
    }
  });
});
