import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { hasChromium } from "../../../fixtures/snapshot/chromium-available.ts";

const execFileAsync = promisify(execFile);

// The __name bug only surfaces under the real tsx runtime (esbuild keepNames),
// not under vitest's transform — so the browser test can't guard it. This spawns
// the probe through tsx and asserts the render survives. Skipped when Chromium
// isn't installed (CI runs with PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1).
describe.skipIf(!hasChromium)("createPlaywrightDriver __name shim (tsx subprocess regression)", () => {
  it(
    "renders under the tsx runtime without a `__name is not defined` ReferenceError",
    { timeout: 60_000 },
    async () => {
      const { stdout, stderr } = await execFileAsync(
        "pnpm",
        ["exec", "tsx", "tests/fixtures/snapshot/name-shim-probe.ts"],
        { cwd: process.cwd() },
      ).catch((error: { stdout?: string; stderr?: string }) => ({
        stdout: error.stdout ?? "",
        stderr: error.stderr ?? "",
      }));

      // The precise regression this test guards: dropping the addInitScript shim
      // makes esbuild's `__name` helper undefined inside the serialized
      // page.evaluate bodies.
      expect(`${stdout}\n${stderr}`).not.toMatch(/__name is not defined/);
      expect(stdout).toContain("PROBE_OK");
    },
  );
});
