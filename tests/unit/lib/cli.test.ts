import { CliUsageError, parseServiceArgs } from "#lib/cli/index.ts";

describe("parseServiceArgs", () => {
  it("parses --project into projectPath", () => {
    const args = parseServiceArgs(["--project", "/x"]);

    expect(args.projectPath).toBe("/x");
    expect(args.force).toBe(false);
  });

  it("parses --force as true when present", () => {
    const args = parseServiceArgs(["--project", "/x", "--force"]);

    expect(args.force).toBe(true);
  });

  it("throws CliUsageError when --project is missing", () => {
    expect(() => parseServiceArgs(["--force"])).toThrow(CliUsageError);
  });

  it("throws CliUsageError on unknown flags", () => {
    expect(() => parseServiceArgs(["--project", "/x", "--bogus"])).toThrow(CliUsageError);
  });

  it("throws CliUsageError with usage text on --help", () => {
    expect(() => parseServiceArgs(["--help"])).toThrow(CliUsageError);
    expect(() => parseServiceArgs(["--help"])).toThrow(/--project <path>/);
  });

  it("exposes exit code 2 on CliUsageError", () => {
    try {
      parseServiceArgs([]);
      expect.unreachable("parseServiceArgs must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CliUsageError);
      expect((error as CliUsageError).exitCode).toBe(2);
    }
  });

  describe("extraFlags", () => {
    it("parses extra string and boolean flags", () => {
      const args = parseServiceArgs(["--project", "/x", "--block", "hero", "--refresh"], {
        extraFlags: {
          block: { type: "string" },
          refresh: { type: "boolean" },
        },
      });

      expect(args.projectPath).toBe("/x");
      expect(args["block"]).toBe("hero");
      expect(args["refresh"]).toBe(true);
    });

    it("leaves absent extra flags undefined", () => {
      const args = parseServiceArgs(["--project", "/x"], {
        extraFlags: { block: { type: "string" } },
      });

      expect(args["block"]).toBeUndefined();
    });

    it("mentions extra flags in the usage text", () => {
      expect(() =>
        parseServiceArgs(["--help"], {
          extraFlags: { refresh: { type: "boolean" } },
        }),
      ).toThrow(/--refresh/);
    });
  });
});
