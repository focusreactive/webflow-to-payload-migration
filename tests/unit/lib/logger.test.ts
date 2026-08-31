import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import { createLogger } from "#lib/logger.ts";

function captureStream(): { stream: PassThrough; output: () => string } {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  return { stream, output: () => Buffer.concat(chunks).toString("utf8") };
}

describe("createLogger", () => {
  it("filters messages below the configured level", () => {
    const { stream, output } = captureStream();
    const logger = createLogger({ level: "info", stderr: stream });

    logger.debug("hidden");
    logger.info("shown");

    expect(output()).not.toContain("hidden");
    expect(output()).toContain("shown");
  });

  it("writes pretty lines containing level and message", () => {
    const { stream, output } = captureStream();
    const logger = createLogger({ level: "debug", stderr: stream });

    logger.warn("disk almost full");

    expect(output()).toContain("warn");
    expect(output()).toContain("disk almost full");
  });

  describe("ndjson file sink", () => {
    let dir: string;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), "logger-test-"));
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    async function readNdjsonLines(filePath: string): Promise<Record<string, unknown>[]> {
      const content = await readFile(filePath, "utf8");
      return content
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    }

    it("writes one json object per line with level, msg and data", async () => {
      const { stream } = captureStream();
      const filePath = join(dir, "logs", "step.log");
      const logger = createLogger({ level: "debug", stderr: stream, filePath });

      logger.info("page fetched", { url: "https://example.com", status: 200 });
      logger.error("fetch failed", { url: "https://example.com/missing" });

      const lines = await readNdjsonLines(filePath);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatchObject({
        level: "info",
        msg: "page fetched",
        url: "https://example.com",
        status: 200,
      });
      expect(lines[1]).toMatchObject({
        level: "error",
        msg: "fetch failed",
        url: "https://example.com/missing",
      });
    });

    it("does not write filtered levels to the file", async () => {
      const { stream } = captureStream();
      const filePath = join(dir, "step.log");
      const logger = createLogger({ level: "warn", stderr: stream, filePath });

      logger.info("hidden");
      logger.warn("shown");

      const lines = await readNdjsonLines(filePath);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ level: "warn", msg: "shown" });
    });

    it("appends to an existing file instead of truncating", async () => {
      const { stream } = captureStream();
      const filePath = join(dir, "step.log");

      createLogger({ level: "info", stderr: stream, filePath }).info("first");
      createLogger({ level: "info", stderr: stream, filePath }).info("second");

      const lines = await readNdjsonLines(filePath);
      expect(lines.map((line) => line.msg)).toEqual(["first", "second"]);
    });
  });
});
