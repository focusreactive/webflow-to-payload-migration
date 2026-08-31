import {
  GLOBAL_NAMES,
  GLOBALS_SCHEMA_VERSION,
  globalComponentId,
  globalDefSchema,
  globalsArtifact,
  globalsDataSchema,
} from "#ir/globals.ts";

const header = {
  name: "Site header",
  fields: [
    { name: "logo", type: { type: "image" }, required: true },
    {
      name: "navItems",
      label: "Navigation",
      type: {
        type: "array",
        element: {
          type: "group",
          fields: [
            { name: "label", type: { type: "text" }, required: true },
            { name: "url", type: { type: "url" }, required: true },
          ],
        },
      },
      required: true,
    },
  ],
  values: {
    logo: { assetId: "a1", alt: "Acme" },
    navItems: [{ label: "About", url: "/about" }],
  },
};

describe("globals contract", () => {
  it("accepts a header definition with recursive fields and JSON values", () => {
    expect(globalDefSchema.safeParse(header).success).toBe(true);
  });

  it("mints ComponentId from the fixed names only", () => {
    expect(String(globalComponentId("header"))).toBe("header");
    expect(String(globalComponentId("footer"))).toBe("footer");
    expect(GLOBAL_NAMES).toEqual(["header", "footer"]);
  });

  it("rejects unknown keys and non-JSON values", () => {
    expect(globalDefSchema.safeParse({ ...header, extra: 1 }).success).toBe(false);
    expect(globalDefSchema.safeParse({ ...header, values: { logo: undefined } }).success).toBe(false);
  });

  it("exposes the registry artifact", () => {
    expect(globalsArtifact.kind).toBe("globals");
    expect(globalsArtifact.relativePath).toBe("globals.json");
    expect(globalsArtifact.schemaVersion).toBe(GLOBALS_SCHEMA_VERSION);
    expect(GLOBALS_SCHEMA_VERSION).toBe(3);
    expect(globalsDataSchema.safeParse({ globals: [header] }).success).toBe(true);
  });

  it("round-trips through globalsDataSchema", () => {
    const parsed = globalsDataSchema.parse({ globals: [header] });
    expect(parsed).toEqual({ globals: [header] });
  });
});
