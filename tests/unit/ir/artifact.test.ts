import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import {
  ArtifactVersionError,
  artifactEnvelope,
  readArtifact,
  readNdjsonArtifact,
  writeArtifact,
  writeNdjsonArtifact,
  type ArtifactDef,
} from "#ir/artifact.ts";

const pageSchema = z.strictObject({ route: z.string(), title: z.string() });
type Page = z.infer<typeof pageSchema>;

const pagesDef: ArtifactDef<Page> = {
  kind: "test-pages",
  relativePath: "test-pages.json",
  schemaVersion: 1,
  dataSchema: pageSchema,
};

const itemSchema = z.strictObject({ id: z.string(), body: z.string() });
type Item = z.infer<typeof itemSchema>;

const itemsDef: ArtifactDef<Item> = {
  kind: "test-items",
  relativePath: "content/test-items.ndjson",
  schemaVersion: 1,
  dataSchema: itemSchema,
};

describe("artifactEnvelope", () => {
  it("validates schemaVersion, provenance and data", () => {
    const envelope = artifactEnvelope(pageSchema, 1);

    const parsed = envelope.parse({
      schemaVersion: 1,
      provenance: "published",
      data: { route: "/", title: "Home" },
    });

    expect(parsed.data.title).toBe("Home");
  });

  it("rejects unknown keys at the envelope level", () => {
    const envelope = artifactEnvelope(pageSchema, 1);

    expect(() =>
      envelope.parse({
        schemaVersion: 1,
        provenance: "published",
        data: { route: "/", title: "Home" },
        extra: true,
      }),
    ).toThrow();
  });
});

describe("json artifacts", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "artifact-test-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("round-trips write and read", async () => {
    const payload = {
      provenance: "published",
      data: { route: "/about", title: "About" },
    } as const;

    await writeArtifact(projectPath, pagesDef, payload);

    await expect(readArtifact(projectPath, pagesDef)).resolves.toEqual(payload);
  });

  it("rejects unknown keys in data on write", async () => {
    await expect(
      writeArtifact(projectPath, pagesDef, {
        provenance: "published",
        // @ts-expect-error -- unknown key must also fail at runtime
        data: { route: "/", title: "Home", sneaky: true },
      }),
    ).rejects.toThrow();
  });

  it("throws ArtifactVersionError naming the producing step on version mismatch", async () => {
    await writeArtifact(projectPath, pagesDef, {
      provenance: "published",
      data: { route: "/", title: "Home" },
    });
    const staleDef: ArtifactDef<Page> = { ...pagesDef, schemaVersion: 2 };

    await expect(readArtifact(projectPath, staleDef)).rejects.toThrow(ArtifactVersionError);
    await expect(readArtifact(projectPath, staleDef)).rejects.toThrow(/test-pages/);
  });

  it("writes byte-identical files for identical payloads", async () => {
    const payload = {
      provenance: "api",
      data: { route: "/", title: "Home" },
    } as const;
    const artifactPath = join(projectPath, ".migration", "artifacts", pagesDef.relativePath);

    await writeArtifact(projectPath, pagesDef, payload);
    const first = await readFile(artifactPath);
    await writeArtifact(projectPath, pagesDef, payload);
    const second = await readFile(artifactPath);

    expect(first.equals(second)).toBe(true);
  });

  it("serializes as pretty json with a trailing newline", async () => {
    await writeArtifact(projectPath, pagesDef, {
      provenance: "published",
      data: { route: "/", title: "Home" },
    });

    const content = await readFile(join(projectPath, ".migration", "artifacts", pagesDef.relativePath), "utf8");
    expect(content.endsWith("\n")).toBe(true);
    expect(content).toContain('  "schemaVersion": 1');
  });
});

describe("ndjson artifacts", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "ndjson-test-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("round-trips items with a meta header line", async () => {
    const items: Item[] = [
      { id: "a", body: "first" },
      { id: "b", body: "second" },
    ];

    await writeNdjsonArtifact(projectPath, itemsDef, {
      provenance: "api",
      items,
    });
    const result = await readNdjsonArtifact(projectPath, itemsDef);

    expect(result.meta).toMatchObject({
      kind: "meta",
      schemaVersion: 1,
      provenance: "api",
    });
    expect(result.items).toEqual(items);
  });

  it("starts the file with the meta header line", async () => {
    await writeNdjsonArtifact(projectPath, itemsDef, {
      provenance: "api",
      items: [{ id: "a", body: "first" }],
    });

    const content = await readFile(join(projectPath, ".migration", "artifacts", itemsDef.relativePath), "utf8");
    const firstLine = content.split("\n")[0] ?? "";
    expect(JSON.parse(firstLine)).toMatchObject({ kind: "meta" });
  });

  it("throws ArtifactVersionError on meta version mismatch", async () => {
    await writeNdjsonArtifact(projectPath, itemsDef, {
      provenance: "api",
      items: [],
    });
    const staleDef: ArtifactDef<Item> = { ...itemsDef, schemaVersion: 9 };

    await expect(readNdjsonArtifact(projectPath, staleDef)).rejects.toThrow(ArtifactVersionError);
  });

  it("reports the line number of an invalid record", async () => {
    const filePath = join(projectPath, ".migration", "artifacts", itemsDef.relativePath);
    await writeNdjsonArtifact(projectPath, itemsDef, {
      provenance: "api",
      items: [{ id: "a", body: "ok" }],
    });
    const valid = await readFile(filePath, "utf8");
    await writeFile(filePath, `${valid}{"id":"broken"}\n`);

    await expect(readNdjsonArtifact(projectPath, itemsDef)).rejects.toThrow(/line 3/);
  });
});
