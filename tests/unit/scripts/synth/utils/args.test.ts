import { requireAddress, requireSurface, requireVertical } from "#synth/utils/args.ts";

const base = { projectPath: "/tmp/p", force: false };

describe("requireAddress", () => {
  it("resolves the vertical from the entity flag that was named", () => {
    expect(requireAddress({ ...base, block: "hero" }).vertical.id).toBe("blocks");
    expect(requireAddress({ ...base, global: "header" }).vertical.id).toBe("globals");
    expect(requireAddress({ ...base, collection: "blog" }).vertical.id).toBe("collections");
  });

  it("refuses no entity flag and refuses two at once", () => {
    expect(() => requireAddress({ ...base })).toThrow(/--block <typeId>/);
    expect(() => requireAddress({ ...base, block: "hero", global: "header" })).toThrow(/one entity at a time/);
  });

  it("refuses --section outside the sectioned vertical", () => {
    expect(() => requireAddress({ ...base, block: "hero", section: "top" })).toThrow(
      /--section applies to --collection/,
    );
    expect(requireAddress({ ...base, collection: "blog", section: "top" }).address).toEqual({
      key: "blog",
      section: "top",
    });
  });
});

describe("requireSurface", () => {
  it("requires a section for a collection surface and leaves other verticals alone", () => {
    expect(() => requireSurface({ ...base, collection: "blog" })).toThrow(/--section <id> is required/);
    expect(requireSurface({ ...base, block: "hero" }).address).toEqual({ key: "hero" });
  });
});

describe("requireVertical", () => {
  it("resolves a named vertical and refuses an unknown one", () => {
    expect(requireVertical({ ...base, vertical: "globals" }).id).toBe("globals");
    expect(() => requireVertical({ ...base })).toThrow(/--vertical/);
    expect(() => requireVertical({ ...base, vertical: "pages" })).toThrow(/--vertical/);
  });
});
