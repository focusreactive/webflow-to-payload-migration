import { describe, expect, it } from "vitest";

import { emitPayloadConfigFile } from "#generate/steps/scaffold/payload-config.ts";

describe("emitPayloadConfigFile", () => {
  it("wires the sqlite adapter with schema push enabled", () => {
    const source = emitPayloadConfigFile({ collectionSlugs: ["posts"], globalNames: ["header"] });

    expect(source).toContain('import { sqliteAdapter } from "@payloadcms/db-sqlite"');
    expect(source).toContain("push: true");
    expect(source).not.toContain("postgresAdapter");
    expect(source).not.toContain("@payloadcms/db-postgres");
  });

  it("registers the migrated collections and globals alongside the built-ins", () => {
    const source = emitPayloadConfigFile({ collectionSlugs: ["posts"], globalNames: ["header"] });

    expect(source).toContain("PagesCollection");
    expect(source).toContain("Media");
    expect(source).toContain("Users");
    expect(source).toContain("PostsCollection");
    expect(source).toContain("HeaderGlobal");
  });
});
