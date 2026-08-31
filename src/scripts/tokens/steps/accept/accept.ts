import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { artifactPath, readArtifact, writeArtifact } from "#ir/artifact.ts";
import { CliUsageError } from "#lib/cli/index.ts";
import { recordArtifact, updateStep } from "#lib/manifest/index.ts";

import { designTokensArtifact } from "../../schemas/design-tokens.ts";
import { tokenCandidatesArtifact } from "../../schemas/token-candidates.ts";
import { RESPONSE_RELATIVE_PATH } from "../../constants/paths.ts";
import { TOKENS_ACCEPT_STEP_ID, TOKENS_JUDGE_STEP_ID } from "../../constants/ids.ts";

import { assembleDesignTokens } from "./services/assemble.ts";
import { validateResponse, type AcceptError } from "./services/validate-response.ts";

async function readResponse(projectPath: string): Promise<unknown> {
  const path = join(projectPath, RESPONSE_RELATIVE_PATH);
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CliUsageError(`tokens accept: cannot read the response at ${path}\n${reason}`);
  }
}

function reportErrors(errors: AcceptError[]): void {
  console.log(JSON.stringify({ ok: false, errors }, null, 2));
  process.exitCode = 1;
}

export async function runAccept(projectPath: string): Promise<void> {
  const candidates = (await readArtifact(projectPath, tokenCandidatesArtifact)).data;
  const result = validateResponse(candidates, await readResponse(projectPath));
  if (!result.ok) {
    reportErrors(result.errors);
    return;
  }

  const data = assembleDesignTokens({ candidates, response: result.response });

  await writeArtifact(projectPath, designTokensArtifact, { provenance: "ai", data });
  await recordArtifact(
    projectPath,
    TOKENS_ACCEPT_STEP_ID,
    "design-tokens",
    artifactPath(projectPath, designTokensArtifact),
  );

  const finishedAt = new Date().toISOString();
  await updateStep(projectPath, TOKENS_JUDGE_STEP_ID, { status: "done", finishedAt });
  await updateStep(projectPath, TOKENS_ACCEPT_STEP_ID, { status: "done", finishedAt });

  console.log(
    JSON.stringify({
      ok: true,
      artifact: artifactPath(projectPath, designTokensArtifact),
      primitiveColors: Object.keys(data.primitive.color).length,
      roles: Object.keys(data.semantic.color).length,
    }),
  );
}
