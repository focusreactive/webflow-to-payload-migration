import { join } from "node:path";

import { artifactPath, readArtifact, writeArtifact } from "#ir/artifact.ts";
import { fontAssetsArtifact, type FontAssetsData } from "#ir/assets.ts";
import { createLogger } from "#lib/logger.ts";
import { readManifest, recordArtifact, withStep } from "#lib/manifest/index.ts";
import { openSnapshotStore, readOnlyClient } from "#lib/snapshot-store/index.ts";

import { ASSETS_FONTS_STEP_ID } from "../../constants/ids.ts";
import { LOG_RELATIVE_PATH } from "../../constants/paths.ts";

import { buildFontAssets } from "./build-font-assets.ts";

export async function runFonts(projectPath: string, force: boolean): Promise<void> {
  const logger = createLogger({
    level: "info",
    filePath: join(projectPath, LOG_RELATIVE_PATH),
  });

  const store = await openSnapshotStore(projectPath, readOnlyClient());

  const manifest = await readManifest(projectPath);
  const wasSkipped = manifest.steps[ASSETS_FONTS_STEP_ID]?.status === "done" && !force;

  const computed = await withStep(
    projectPath,
    ASSETS_FONTS_STEP_ID,
    async () => {
      const data = await buildFontAssets(store);
      await writeArtifact(projectPath, fontAssetsArtifact, {
        provenance: "published",
        data,
      });
      await recordArtifact(projectPath, ASSETS_FONTS_STEP_ID, "fonts", artifactPath(projectPath, fontAssetsArtifact));
      logger.info("assets: font inventory written", { fonts: data.assets.length });
      return data;
    },
    { force },
  );

  const data: FontAssetsData =
    wasSkipped ? (await readArtifact(projectPath, fontAssetsArtifact)).data : (computed as FontAssetsData);

  console.log(
    JSON.stringify({
      step: ASSETS_FONTS_STEP_ID,
      status: wasSkipped ? "skipped" : "done",
      fonts: data.assets.length,
      licenseRisk: data.assets.filter((asset) => asset.font.licenseRisk).length,
    }),
  );
}
