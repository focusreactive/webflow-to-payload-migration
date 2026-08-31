import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { detectPlatform } from "#detect/detect-platform.ts";
import type { Verdict } from "#detect/scoring.ts";

import { listDetectionFixtures, loadDetectionFixture } from "../../../fixtures/detection/load.ts";

// Groups whose verdict semantics are defined by this calibration gate. Filtering
// to these keeps the run stable even if a sibling suite's transient scratch
// group (e.g. the fixture-loader test's __fixture-loader-test__) is briefly on
// disk, while still picking up any NEW webflow/negative fixtures.
const CALIBRATION_GROUPS = new Set(["webflow", "negative"]);

interface ExpectedFile {
  verdict: Verdict;
}

async function readExpected(dir: string): Promise<ExpectedFile> {
  return JSON.parse(await readFile(join(dir, "expected.json"), "utf8")) as ExpectedFile;
}

const fixtures = (await listDetectionFixtures()).filter((fixture) => CALIBRATION_GROUPS.has(fixture.group));

describe("detection fixtures — real detector over collected sites", () => {
  it("discovered fixtures across both calibration groups", () => {
    // Guard against the loop silently running over zero fixtures.
    const groups = new Set(fixtures.map((fixture) => fixture.group));
    expect(groups).toEqual(CALIBRATION_GROUPS);
    expect(fixtures.length).toBeGreaterThanOrEqual(2);
  });

  describe.each(fixtures)("$group/$name", ({ group, name, dir }) => {
    const label = `${group}/${name}`;

    it(`verdict matches expected.json (${label})`, async () => {
      const expected = await readExpected(dir);
      const data = await loadDetectionFixture(dir);
      const result = detectPlatform(data);

      expect(
        result.verdict,
        `${label}: verdict ${result.verdict} != expected ${expected.verdict} `
          + `(webflow score=${result.scores.webflow.score} tier1=${result.scores.webflow.hasTier1Strong})`,
      ).toBe(expected.verdict);
    });

    it(`hasTier1Strong flags are correct for the group (${label})`, async () => {
      const data = await loadDetectionFixture(dir);
      const result = detectPlatform(data);

      if (group === "webflow") {
        expect(result.scores.webflow.hasTier1Strong, `${label}: expected a Tier-1 strong Webflow signal`).toBe(true);
      } else {
        expect(
          result.scores.webflow.hasTier1Strong,
          `${label}: negative fixture must have NO Tier-1 strong Webflow signal`,
        ).toBe(false);
      }
    });
  });

  it("webflow/j-magazine exposes webflowSiteId in platformHints", async () => {
    const fixture = fixtures.find((entry) => entry.group === "webflow" && entry.name === "j-magazine");
    expect(fixture, "webflow/j-magazine fixture must exist").toBeDefined();

    const result = detectPlatform(await loadDetectionFixture(fixture!.dir));
    expect(result.platformHints.webflowSiteId).toBeTruthy();
  });
});
