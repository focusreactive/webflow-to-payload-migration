import { join } from "node:path";

import { readArtifact } from "#ir/artifact.ts";
import { writeFileAtomic } from "#lib/fs.ts";
import { recordArtifact, updateStep } from "#lib/manifest/index.ts";

import { emitThemeCss } from "./services/emit-theme.ts";
import { designTokensArtifact } from "../../schemas/design-tokens.ts";
import { THEME_CSS_RELATIVE_PATH } from "../../constants/paths.ts";
import { TOKENS_THEME_STEP_ID } from "../../constants/ids.ts";

export async function runTheme(projectPath: string): Promise<void> {
  const { data } = await readArtifact(projectPath, designTokensArtifact);
  const themePath = join(projectPath, THEME_CSS_RELATIVE_PATH);

  await writeFileAtomic(themePath, emitThemeCss(data));
  await recordArtifact(projectPath, TOKENS_THEME_STEP_ID, "theme-css", themePath);
  await updateStep(projectPath, TOKENS_THEME_STEP_ID, {
    status: "done",
    finishedAt: new Date().toISOString(),
  });

  console.log(JSON.stringify({ step: TOKENS_THEME_STEP_ID, status: "done", theme: themePath }));
}
