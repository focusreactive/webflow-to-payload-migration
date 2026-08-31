import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sanitizeFileName, writeFileAtomic } from "#lib/fs.ts";

describe("writeFileAtomic", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "fs-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes a file, creating parent directories", async () => {
    const target = join(dir, "a", "b", "c.txt");

    await writeFileAtomic(target, "payload");

    await expect(readFile(target, "utf8")).resolves.toBe("payload");
  });

  it("writes Buffer content byte-for-byte", async () => {
    const target = join(dir, "bin.dat");
    const bytes = Buffer.from([0, 1, 2, 255]);

    await writeFileAtomic(target, bytes);

    expect(await readFile(target)).toEqual(bytes);
  });

  it("overwrites an existing file with the new content", async () => {
    const target = join(dir, "file.txt");

    await writeFileAtomic(target, "first");
    await writeFileAtomic(target, "second");

    await expect(readFile(target, "utf8")).resolves.toBe("second");
  });

  it("leaves no tmp files behind after successful writes", async () => {
    const target = join(dir, "file.txt");

    await writeFileAtomic(target, "first");
    await writeFileAtomic(target, "second");

    expect(await readdir(dir)).toEqual(["file.txt"]);
  });

  it("cleans up the tmp file and does not create the target when rename fails", async () => {
    const target = join(dir, "occupied");
    await mkdir(target);

    await expect(writeFileAtomic(target, "payload")).rejects.toThrow();

    expect(await readdir(dir)).toEqual(["occupied"]);
    expect(await readdir(target)).toEqual([]);
  });
});

describe("sanitizeFileName", () => {
  it("replaces spaces and special characters with dashes and lowercases", () => {
    expect(sanitizeFileName("My Photo (Final).PNG")).toBe("my-photo-final.png");
  });

  it("decodes percent-encoded sequences", () => {
    expect(sanitizeFileName("img%20name.jpg")).toBe("img-name.jpg");
  });

  it("strips query strings and fragments", () => {
    expect(sanitizeFileName("photo.jpg?v=123")).toBe("photo.jpg");
    expect(sanitizeFileName("photo.jpg#section")).toBe("photo.jpg");
  });

  it("falls back to a non-empty name when nothing survives sanitizing", () => {
    expect(sanitizeFileName("???")).not.toBe("");
  });

  it("appends a short hash suffix on collision with existing names", () => {
    const existing = new Set(["photo.jpg"]);

    const name = sanitizeFileName("photo.jpg", { existing });

    expect(name).toMatch(/^photo-[0-9a-f]{8}\.jpg$/);
    expect(existing.has(name)).toBe(false);
  });

  it("is deterministic for the same input", () => {
    const existing = new Set(["photo.jpg"]);

    expect(sanitizeFileName("photo.jpg", { existing })).toBe(sanitizeFileName("photo.jpg", { existing }));
  });

  it("is idempotent", () => {
    const once = sanitizeFileName("My Photo (Final).PNG");

    expect(sanitizeFileName(once)).toBe(once);
  });
});
