import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkFonts, checkLaneOrigins, checkReferenceStyled, checkViewportDpr } from "#synth/steps/preflight/checks.ts";
import { allowsOrigin } from "#synth/steps/preflight/utils/allowed-origins.ts";

describe("checkViewportDpr", () => {
  it("passes when every viewport shares one ratio", () => {
    const result = checkViewportDpr(
      {
        desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
        mobile: { width: 390, height: 844, deviceScaleFactor: 1 },
      },
      1,
    );
    expect(result.ok).toBe(true);
  });

  it("fails when viewports disagree", () => {
    const result = checkViewportDpr(
      {
        desktop: { width: 1440, height: 900, deviceScaleFactor: 2 },
        mobile: { width: 390, height: 844, deviceScaleFactor: 1 },
      },
      1,
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("desktop");
  });

  it("fails when the project ratio differs from the mcp one", () => {
    const result = checkViewportDpr({ desktop: { width: 1440, height: 900, deviceScaleFactor: 2 } }, 1);
    expect(result.ok).toBe(false);
  });
});

describe("checkFonts", () => {
  it("fails when the snapshot carries no fonts stylesheet", async () => {
    const root = await mkdtemp(join(tmpdir(), "preflight-"));
    expect((await checkFonts(root)).ok).toBe(false);
  });

  it("passes once fonts.css exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "preflight-"));
    await mkdir(join(root, ".migration/snapshot/styles"), { recursive: true });
    await writeFile(join(root, ".migration/snapshot/styles/fonts.css"), "@font-face{}");
    expect((await checkFonts(root)).ok).toBe(true);
  });
});

describe("checkLaneOrigins", () => {
  it("fails on a bare host, which carries no port and so matches nothing we serve", () => {
    const result = checkLaneOrigins({ "pw-1": ["localhost"] }, ["http://localhost:4180"]);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("pw-1 blocks http://localhost:4180");
  });

  it("passes on a port wildcard for both servers", () => {
    const result = checkLaneOrigins({ "pw-1": ["localhost", "localhost:*"] }, [
      "http://localhost:4180",
      "http://localhost:5173",
    ]);
    expect(result.ok).toBe(true);
  });

  it("still refuses an off-localhost origin", () => {
    expect(allowsOrigin(["localhost:*"], "https://fonts.googleapis.com")).toBe(false);
    expect(allowsOrigin(["localhost:*"], "http://127.0.0.1:4180")).toBe(false);
  });

  it("treats an empty allowlist as no interception at all", () => {
    expect(checkLaneOrigins({ "pw-1": [] }, ["http://localhost:4180"]).ok).toBe(true);
  });
});

describe("checkReferenceStyled", () => {
  it("passes when every locally served stylesheet applied its rules", () => {
    const result = checkReferenceStyled({
      route: "/",
      linked: ["/a/CSS"],
      applied: [{ href: "/a/CSS", rules: 1603 }],
    });
    expect(result.ok).toBe(true);
    expect(result.detail).toContain("1603");
  });

  // The SRI regression: the href is rewritten to the local asset route but the CDN's
  // integrity hash survives, so Chromium drops the sheet and the reference renders
  // unstyled. The page still answers 200 with a complete DOM, which is why nothing
  // else in the preflight can see it.
  it("fails when a linked stylesheet never applied", () => {
    const result = checkReferenceStyled({
      route: "/",
      linked: ["/a/CSS"],
      applied: [],
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("/a/CSS");
  });

  it("fails when a stylesheet applied zero rules", () => {
    const result = checkReferenceStyled({
      route: "/",
      linked: ["/a/CSS"],
      applied: [{ href: "/a/CSS", rules: 0 }],
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("/a/CSS");
  });

  // Third-party stylesheets are blocked by the lane allowlist on purpose, so they are
  // never linked locally and must not be counted as a drop.
  it("ignores stylesheets that are not served locally", () => {
    const result = checkReferenceStyled({
      route: "/",
      linked: [],
      applied: [],
    });
    expect(result.ok).toBe(true);
  });
});
